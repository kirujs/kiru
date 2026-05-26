import * as AST from "./ast.js"
import {
  formatRegionsLiteral,
  getCompileRegionsForJsxs,
} from "./compileRegions.js"
import { MagicString, TransformCTX } from "./shared.js"
import { walkProgramBody } from "./scopeWalk.js"
import {
  blocksModuleHoist,
  isKiruJsxFactoryCall,
  isModuleSignalBinding,
  isSignalFactoryCall,
  isStaticLiteral,
  type BindingInfo,
} from "./scope.js"

type AstNode = AST.AstNode

type Hoistable = {
  node: AstNode
  code: string
  varName: string
}

type AnalysisCtx = {
  resolve: (name: string) => BindingInfo | null
  isJsxProd: (node: AstNode) => boolean
  isJsxs: (node: AstNode) => boolean
  isJsxDev: (node: AstNode) => boolean
}

function createAnalysisCtx(
  resolve: (name: string) => BindingInfo | null
): AnalysisCtx {
  return {
    resolve,
    isJsxProd: (node) =>
      isKiruJsxFactoryCall(node, resolve, "jsx") ||
      isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxs: (node) => isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxDev: (node) => isKiruJsxFactoryCall(node, resolve, "jsxDEV"),
  }
}

const NON_TRACKING_SIGNAL_METHODS = new Set(["peek", "set", "sneak"])

/** Matches `FLAG_HOISTED` in packages/lib/src/constants.ts (1 << 5). */
const FLAG_HOISTED_BIT = 32

export function prepareJSXHoisting(ctx: TransformCTX) {
  const { code, ast } = ctx
  const bodyNodes = ast.body as AstNode[]

  const hoistableCalls: AstNode[] = []
  const hoistableRegionArrays: AstNode[] = []
  const dynamicSlotCalls: {
    node: AstNode
    regions: import("kiru/template").CompileRegion[]
  }[] = []

  const scope = walkProgramBody(bodyNodes, {
    onCallExpression: (node, walkCtx) => {
      const analysis = createAnalysisCtx(walkCtx.resolve)
      if (canHoistToModule(node, analysis)) {
        hoistableCalls.push(node)
      }
      const regions = getCompileRegionsForJsxs(node, analysis)
      if (regions) {
        dynamicSlotCalls.push({ node, regions })
      }
    },
    onArrayExpression: (node, walkCtx) => {
      const analysis = createAnalysisCtx(walkCtx.resolve)
      if (
        isCreateHoledTemplateRegionHole(
          node,
          walkCtx.parent(),
          walkCtx.grandparent()
        ) &&
        canHoistRegionArray(node, analysis)
      ) {
        hoistableRegionArrays.push(node)
      }
    },
  })

  const resolve = (name: string) => scope.resolve(name)
  const analysis = createAnalysisCtx(resolve)

  if (
    hoistableCalls.length === 0 &&
    hoistableRegionArrays.length === 0 &&
    dynamicSlotCalls.length === 0
  ) {
    return
  }

  const source = code.toString()
  let counter = 0
  const allHoistables: Hoistable[] = []
  const hoistedNodes = new Set<AstNode>()
  const regionArraysToHoist = new Set(hoistableRegionArrays)

  const callsForHoist = hoistableCalls.filter(
    (call) => !isDirectChildOfAnyArray(call, regionArraysToHoist)
  )

  const maximalHoists = filterMaximalHoistCandidates(callsForHoist)
  const sortedRegionArrays = [...regionArraysToHoist].sort(
    (a, b) => a.start - b.start
  )
  const sortedHoists = [...maximalHoists].sort((a, b) => a.start - b.start)

  const sortedAllNodes = [...sortedRegionArrays, ...sortedHoists].sort(
    (a, b) => a.start - b.start
  )

  let needsTagStaticChildrenList = false
  for (const node of sortedAllNodes) {
    const varName = `$k${counter++}`
    if (node.type === "ArrayExpression") {
      const arrayCode = source.slice(node.start, node.end)
      const fullyStatic = isFullyStaticRegionArray(node, analysis)
      if (fullyStatic) needsTagStaticChildrenList = true
      const codeExpr = fullyStatic
        ? `tagStaticChildrenList(${arrayCode})`
        : arrayCode
      allHoistables.push({ node, code: codeExpr, varName })
    } else {
      allHoistables.push({
        node,
        code: source.slice(node.start, node.end),
        varName,
      })
    }
  }

  const declarations =
    allHoistables.length === 0
      ? null
      : allHoistables.length === 1
      ? `const ${allHoistables[0].varName} = ${allHoistables[0].code}`
      : allHoistables
          .map((h, i) =>
            i === 0
              ? `const ${h.varName} = ${h.code}`
              : `  ${h.varName} = ${h.code}`
          )
          .join(",\n")
  const metaLines =
    allHoistables.length > 0
      ? buildElementMetaAssignmentLines(allHoistables, analysis)
      : []

  // Hoist leaf replacements first, then wrap mixed parents with the updated tree.
  for (let i = allHoistables.length - 1; i >= 0; i--) {
    const h = allHoistables[i]!
    hoistedNodes.add(h.node)
    code.update(h.node.start, h.node.end, h.varName)
  }

  const sortedDynamicSlots = [...dynamicSlotCalls].sort(
    (a, b) => b.node.start - a.node.start
  )
  for (const { node, regions } of sortedDynamicSlots) {
    if (hoistedNodes.has(node)) continue
    const current = code.slice(node.start, node.end)
    code.update(
      node.start,
      node.end,
      `Object.assign(${current},{meta:{regions:${formatRegionsLiteral(
        regions
      )}}})`
    )
  }

  if (declarations) {
    const minHoistStart = Math.min(...allHoistables.map((h) => h.node.start))
    const moduleDeps = collectReferencedModuleBindings(allHoistables, resolve)
    const insertPos = findModuleHoistInsertPosition(
      bodyNodes,
      minHoistStart,
      source,
      moduleDeps
    )
    const hoistBlock = ["", declarations, ...metaLines, ""].join("\n")
    code.appendRight(insertPos, hoistBlock)
    if (needsTagStaticChildrenList) {
      ensureTagStaticChildrenListImport(code, bodyNodes, source)
    }
  }
}

function isCreateHoledTemplateCall(node: AstNode): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  return callee?.type === "Identifier" && callee.name === "createHoledTemplate"
}

/** Region array: direct element of `createHoledTemplate(_, [ … ])` holes list. */
function isCreateHoledTemplateRegionHole(
  arrayNode: AstNode,
  parent: AstNode | null,
  grandparent: AstNode | null
): boolean {
  if (arrayNode.type !== "ArrayExpression") return false
  if (!parent || parent.type !== "ArrayExpression") return false
  if (!grandparent || !isCreateHoledTemplateCall(grandparent)) return false
  const holesArg = (grandparent as { arguments?: AstNode[] }).arguments?.[1]
  return holesArg === parent
}

function canHoistRegionArray(arrayNode: AstNode, ctx: AnalysisCtx): boolean {
  if (arrayNode.type !== "ArrayExpression") return false
  if (expressionReferencesBlockedBinding(arrayNode, ctx)) return false
  const elems = (
    (arrayNode as { elements?: (AstNode | null)[] }).elements ?? []
  ).filter(Boolean) as AstNode[]
  if (elems.length === 0) return false
  for (const elem of elems) {
    if (!canHoistToModule(elem, ctx)) return false
  }
  return true
}

function isFullyStaticRegionArray(
  arrayNode: AstNode,
  ctx: AnalysisCtx
): boolean {
  if (arrayNode.type !== "ArrayExpression") return false
  const elems = (
    (arrayNode as { elements?: (AstNode | null)[] }).elements ?? []
  ).filter(Boolean) as AstNode[]
  for (const elem of elems) {
    if (!isJsxFactoryCall(elem, ctx)) return false
    if (!isIntrinsicJsxTag(elem.arguments?.[0])) return false
    if (!isHoistableJsxCall(elem, ctx, true)) return false
    if (subtreeHasImpureCall(elem, ctx)) return false
  }
  return elems.length > 0
}

function isDirectChildOfAnyArray(
  callNode: AstNode,
  arrays: Set<AstNode>
): boolean {
  for (const arr of arrays) {
    if (arr.type !== "ArrayExpression") continue
    for (const elem of (arr as { elements?: (AstNode | null)[] }).elements ??
      []) {
      if (elem === callNode) return true
    }
  }
  return false
}

function ensureTagStaticChildrenListImport(
  code: MagicString,
  bodyNodes: AstNode[],
  source: string
): void {
  for (const node of bodyNodes) {
    if (node.type !== "ImportDeclaration") continue
    const src = node.source
    if (
      src?.type !== "Literal" ||
      typeof src.value !== "string" ||
      src.value !== "kiru/template"
    ) {
      continue
    }
    const end = node.end
    const slice = source.slice(node.start, end)
    if (slice.includes("tagStaticChildrenList")) return
    const braceFrom = slice.indexOf("} from")
    if (braceFrom === -1) return
    const start = node.start + braceFrom
    code.overwrite(
      start,
      start + "} from".length,
      ", tagStaticChildrenList } from"
    )
    return
  }
  const insertAt = findModuleHoistInsertPosition(
    bodyNodes,
    source.length,
    source,
    new Set()
  )
  code.appendRight(
    insertAt,
    `import { tagStaticChildrenList } from "kiru/template";\n`
  )
}

function filterMaximalHoistCandidates(calls: AstNode[]): AstNode[] {
  return calls.filter(
    (call) =>
      !calls.some(
        (other) =>
          other !== call &&
          other.start <= call.start &&
          other.end >= call.end &&
          (other.start < call.start || other.end > call.end)
      )
  )
}

function isIntrinsicJsxTag(typeArg: AstNode | null | undefined): boolean {
  return typeArg?.type === "Literal" && typeof typeArg.value === "string"
}

function canHoistToModule(callNode: AstNode, ctx: AnalysisCtx): boolean {
  if (!isJsxFactoryCall(callNode, ctx)) return false
  if (!isIntrinsicJsxTag(callNode.arguments?.[0])) return false
  if (!isHoistableJsxCall(callNode, ctx, false)) return false
  if (expressionReferencesBlockedBinding(callNode, ctx)) return false
  if (subtreeHasImpureCall(callNode, ctx)) return false
  return true
}

function isJsxFactoryCall(callNode: AstNode, ctx: AnalysisCtx): boolean {
  return ctx.isJsxProd(callNode) || ctx.isJsxDev(callNode)
}

function isHoistableJsxCall(
  callNode: AstNode,
  ctx: AnalysisCtx,
  fullyStatic: boolean
): boolean {
  if (!isJsxFactoryCall(callNode, ctx)) return false

  const typeArg = callNode.arguments?.[0]
  if (!typeArg) return false

  const propsArg = callNode.arguments?.[1]
  if (!isHoistableProps(propsArg, ctx, fullyStatic)) return false

  const keyArg = callNode.arguments?.[2]
  if (!isAbsentOrStaticJsxKeyArg(keyArg)) return false

  if (ctx.isJsxDev(callNode)) {
    const isStaticChildrenArg = callNode.arguments?.[3]
    if (
      isStaticChildrenArg !== undefined &&
      isStaticChildrenArg !== null &&
      (isStaticChildrenArg.type !== "Literal" ||
        typeof isStaticChildrenArg.value !== "boolean")
    ) {
      return false
    }
    const sourceArg = callNode.arguments?.[4]
    if (sourceArg && !isStaticLiteral(sourceArg)) return false
    const selfArg = callNode.arguments?.[5]
    if (selfArg && !isHoistableJsxDevSelfArg(selfArg)) return false
  }

  return true
}

function isHoistableProps(
  propsArg: AstNode | undefined | null,
  ctx: AnalysisCtx,
  fullyStatic: boolean
): boolean {
  if (!propsArg) return true
  if (propsArg.type === "Literal") {
    return propsArg.value === null || propsArg.value === undefined
  }
  if (propsArg.type !== "ObjectExpression") return false

  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") return false
    const key =
      prop.key?.name ??
      (typeof prop.key?.value === "string" ? prop.key.value : undefined)
    const value = prop.value as AstNode
    if (key === "children") {
      if (!isHoistableChildValue(value, ctx, fullyStatic)) return false
    } else if (!isHoistablePropValue(value, ctx, fullyStatic)) {
      return false
    }
  }
  return true
}

function isHoistablePropValue(
  value: AstNode,
  ctx: AnalysisCtx,
  fullyStatic: boolean
): boolean {
  if (isInlineFunctionExpression(value)) return false
  if (isStaticLiteral(value)) return true
  if (value.type !== "Identifier" || !value.name) return false
  const binding = ctx.resolve(value.name)
  if (binding?.kind === "moduleStatic" || binding?.kind === "moduleSignal") {
    return true
  }
  if (fullyStatic) return false
  return binding != null && !blocksModuleHoist(binding)
}

function isHoistableChildValue(
  node: AstNode,
  ctx: AnalysisCtx,
  fullyStatic: boolean
): boolean {
  if (!node) return true
  if (isInlineFunctionExpression(node)) return false
  if (node.type === "CallExpression") {
    if (isNonTrackingSignalMemberCall(node, ctx)) return true
    if (fullyStatic) {
      if (isReactiveSignalRead(node, ctx)) return false
      if (isImpureCall(node, ctx)) return false
      return isHoistableJsxCall(node, ctx, true)
    }
    if (isHoistableJsxCall(node, ctx, false)) return true
    if (isImpureCall(node, ctx)) return false
    return !expressionReferencesBlockedBinding(node, ctx)
  }
  if (node.type === "ArrayExpression") {
    for (const elem of (node as { elements?: (AstNode | null)[] }).elements ??
      []) {
      if (!elem) continue
      if (!isHoistableChildValue(elem, ctx, fullyStatic)) return false
    }
    return true
  }
  if (isNonTrackingSignalMemberRead(node, ctx)) return true
  if (fullyStatic) {
    return isFullyStaticExpression(node, ctx)
  }
  return isHoistableExpression(node, ctx)
}

function isHoistableExpression(node: AstNode, ctx: AnalysisCtx): boolean {
  if (isStaticLiteral(node)) return true
  if (node.type === "Identifier") {
    const binding = ctx.resolve(node.name!)
    if (isModuleSignalBinding(binding)) return true
    return !blocksModuleHoist(binding)
  }
  return false
}

function isFullyStaticExpression(node: AstNode, ctx: AnalysisCtx): boolean {
  if (isStaticLiteral(node)) return true
  if (node.type === "Identifier") {
    return isModuleLevelIdentifier(node, ctx)
  }
  if (node.type === "CallExpression") {
    if (isNonTrackingSignalMemberCall(node, ctx)) return true
    if (isReactiveSignalRead(node, ctx)) return false
    if (isImpureCall(node, ctx)) return false
    return isHoistableJsxCall(node, ctx, true)
  }
  return false
}

function isModuleLevelIdentifier(node: AstNode, ctx: AnalysisCtx): boolean {
  if (node.type !== "Identifier" || !node.name) return false
  const binding = ctx.resolve(node.name)
  return binding?.kind === "moduleStatic" || binding?.kind === "moduleSignal"
}

function isInlineFunctionExpression(node: AstNode): boolean {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression"
  )
}

function subtreeHasImpureCall(node: AstNode, ctx: AnalysisCtx): boolean {
  let found = false
  AST.walk(node, {
    CallExpression: (n, walkCtx) => {
      if (isImpureCall(n, ctx)) {
        found = true
        walkCtx.exit()
      }
    },
  })
  return found
}

function expressionReferencesBlockedBinding(
  node: AstNode,
  ctx: AnalysisCtx
): boolean {
  let blocked = false
  AST.walk(node, {
    Identifier: (n, walkCtx) => {
      if (!n.name) return
      if (n.name === "this" || n.name === "undefined") return
      const binding = ctx.resolve(n.name)
      if (binding && blocksModuleHoist(binding)) {
        blocked = true
        walkCtx.exit()
      }
    },
  })
  return blocked
}

function isImpureCall(node: AstNode, ctx: AnalysisCtx): boolean {
  if (node.type !== "CallExpression") return false
  if (isJsxFactoryCall(node, ctx)) return false
  if (isNonTrackingSignalMemberCall(node, ctx)) return false
  if (isSignalFactoryCall(node, ctx.resolve)) return false // signal() factory, not read
  return true
}

function isReactiveSignalRead(node: AstNode, ctx: AnalysisCtx): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee?.type !== "Identifier" || !callee.name) return false
  const binding = ctx.resolve(callee.name)
  return binding?.kind === "moduleSignal" || binding?.kind === "setupConst"
}

function isNonTrackingSignalMemberCall(
  node: AstNode,
  ctx: AnalysisCtx
): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee?.type !== "MemberExpression") return false
  const obj = callee.object
  const prop = callee.property
  if (obj?.type !== "Identifier" || !obj.name || prop?.type !== "Identifier") {
    return false
  }
  const binding = ctx.resolve(obj.name)
  if (binding?.kind !== "moduleSignal" && binding?.kind !== "setupConst") {
    return false
  }
  return NON_TRACKING_SIGNAL_METHODS.has(prop.name!)
}

function isNonTrackingSignalMemberRead(
  node: AstNode,
  ctx: AnalysisCtx
): boolean {
  if (node.type !== "MemberExpression") return false
  const obj = node.object
  const prop = node.property
  if (obj?.type !== "Identifier" || !obj.name || prop?.type !== "Identifier") {
    return false
  }
  const binding = ctx.resolve(obj.name)
  if (binding?.kind !== "moduleSignal" && binding?.kind !== "setupConst") {
    return false
  }
  return prop.name === "peek"
}

function isAbsentOrStaticJsxKeyArg(node: AstNode | undefined | null): boolean {
  if (node === undefined || node === null) return true
  if (isStaticLiteral(node)) return true
  if (node.type === "Identifier" && node.name === "undefined") return true
  if (node.type === "UnaryExpression") {
    const op = (node as { operator?: string }).operator
    const arg = (node as { argument?: AstNode }).argument
    return op === "void" && arg?.type === "Literal" && arg.value === 0
  }
  return false
}

function isHoistableJsxDevSelfArg(node: AstNode): boolean {
  if (node.type === "ThisExpression") return true
  if (node.type === "Literal") {
    return node.value === null || node.value === undefined
  }
  if (node.type === "UnaryExpression") {
    const arg = (node as { argument?: AstNode }).argument
    return (
      (node as { operator?: string }).operator === "void" &&
      arg?.type === "Literal" &&
      arg.value === 0
    )
  }
  if (node.type === "Identifier") {
    return node.name === "undefined" || node.name === "this"
  }
  return false
}

function isHoistedCallNestedIn(
  candidate: Hoistable,
  allHoistables: Hoistable[]
): boolean {
  const start = candidate.node.start
  const end = candidate.node.end
  return allHoistables.some(
    (other) =>
      other !== candidate && other.node.start <= start && other.node.end >= end
  )
}

function collectReferencedModuleBindings(
  allHoistables: Hoistable[],
  resolve: (name: string) => BindingInfo | null
): Set<string> {
  const names = new Set<string>()
  for (const h of allHoistables) {
    AST.walk(h.node, {
      Identifier: (n) => {
        if (!n.name) return
        const kind = resolve(n.name)?.kind
        if (kind === "moduleStatic" || kind === "moduleSignal") {
          names.add(n.name)
        }
      },
    })
  }
  return names
}

function moduleBindingDeclaredInNode(
  node: AstNode,
  moduleDeps: Set<string>
): boolean {
  const checkDecl = (decl: AstNode) => {
    if (decl.type !== "VariableDeclarator") return false
    const id = decl.id
    return id?.type === "Identifier" && !!id.name && moduleDeps.has(id.name)
  }

  if (node.type === "VariableDeclaration") {
    return (node.declarations ?? []).some(checkDecl)
  }
  if (
    node.type === "ExportNamedDeclaration" &&
    node.declaration?.type === "VariableDeclaration"
  ) {
    return (node.declaration.declarations ?? []).some(checkDecl)
  }
  return false
}

/** Insert hoisted `const $kN` after imports and module bindings they reference. */
function findModuleHoistInsertPosition(
  bodyNodes: AstNode[],
  minHoistStart: number,
  source: string,
  moduleDeps: Set<string>
): number {
  let insertAt = 0
  for (const node of bodyNodes) {
    if (node.end > minHoistStart) continue

    if (node.type === "ImportDeclaration") {
      insertAt = Math.max(insertAt, node.end)
      continue
    }

    if (moduleDeps.size > 0 && moduleBindingDeclaredInNode(node, moduleDeps)) {
      insertAt = Math.max(insertAt, node.end)
    }
  }
  while (insertAt < source.length && /\s/.test(source[insertAt]!)) {
    insertAt++
  }
  return insertAt
}

function buildElementMetaLiteral(
  node: AstNode,
  ctx: AnalysisCtx,
  varName: string
): string | null {
  const parts: string[] = []
  const flagsBase = `(${varName}.meta?.flags??0)`
  let flagsExpr: string | null = null
  if (
    isIntrinsicJsxTag(node.arguments?.[0]) &&
    isHoistableJsxCall(node, ctx, true) &&
    !subtreeHasImpureCall(node, ctx)
  ) {
    flagsExpr = `${flagsBase}|${FLAG_HOISTED_BIT}`
  }
  const regions = getCompileRegionsForJsxs(node, ctx)
  if (regions) {
    parts.push(`regions: ${formatRegionsLiteral(regions)}`)
  }
  if (flagsExpr) {
    parts.unshift(`flags: ${flagsExpr}`)
  } else if (regions) {
    parts.unshift(`flags: ${flagsBase}`)
  }
  if (parts.length === 0) return null
  return `{ ${parts.join(", ")} }`
}

function buildElementMetaAssignmentLines(
  allHoistables: Hoistable[],
  ctx: AnalysisCtx
): string[] {
  const lines: string[] = []
  for (const h of allHoistables) {
    if (h.node.type === "ArrayExpression") {
      const elems = (h.node as { elements?: (AstNode | null)[] }).elements ?? []
      for (let i = 0; i < elems.length; i++) {
        const elem = elems[i]
        if (!elem || elem.type !== "CallExpression") continue
        if (!isJsxFactoryCall(elem, ctx)) continue
        const meta = buildElementMetaLiteral(elem, ctx, `${h.varName}[${i}]`)
        if (meta) {
          lines.push(`${h.varName}[${i}].meta=${meta}`)
        }
      }
      continue
    }
    if (h.node.type !== "CallExpression") continue
    if (!isJsxFactoryCall(h.node, ctx)) continue
    if (isHoistedCallNestedIn(h, allHoistables)) continue
    const meta = buildElementMetaLiteral(h.node, ctx, h.varName)
    if (meta) {
      lines.push(`${h.varName}.meta=${meta}`)
    }
  }
  return lines
}
