import type { ProgramNode } from "rollup"
import * as AST from "./ast.js"
import {
  applyCodegenPlan,
  emptyCodegenPlan,
  sliceNode,
  type CodegenPlan,
} from "./codegenPlan.js"
import { TransformCTX } from "./shared.js"
import {
  buildProgramBindingResolve,
  walkProgramBody,
} from "./scopeWalk.js"
import { isKiruJsxFactoryCall } from "./scope.js"
import type { ProgramCallIndex } from "./programCallIndex.js"
import {
  formatBindingPayloadsLiteral,
  formatRegionsLiteral,
  formatTemplateBindingsLiteral,
} from "./compileRegions.js"
import type { TemplateBindingHost } from "./templateHTML.js"
import {
  bindingMatchesComponentRender,
  parseTemplateRefMarkers,
  serializeComponentLeafTemplate,
} from "./componentFold.js"
import {
  isTemplateShellEligibleCall,
  selectMaximalTemplateShellCalls,
  serializeJsxCallToTemplate,
  type TemplateSerializeCtx,
  type TemplateShellCallSite,
} from "./templateHTML.js"
import {
  buildTemplateFactoryExpr,
  htmlUsesTemplateRefs,
} from "./templateComposition.js"
import type { CompileRegion } from "kiru/template"

type AstNode = AST.AstNode

export const TEMPLATE_IMPORT = `import { _template, createHoledTemplate } from "kiru/template";\n`

export type TemplateBinding = {
  node: AstNode
  html: string
  holeCount: number
  holeNodes: AstNode[]
  regions: CompileRegion[]
  bindings: import("kiru/template").TemplateBindingDescriptor[]
  bindingHosts: TemplateBindingHost[]
  structuralNodeCount: number
  structuralWalk: number[]
  varName: string
}

export type HoistedVarBinding = {
  varName: string
  declStart: number
  declEnd: number
  idNode: AstNode
}

export type TemplatePlan = {
  bindings: TemplateBinding[]
  refVarMap: Map<string, string>
  hoistedVarByNode: Map<AstNode, HoistedVarBinding>
  bodyNodes: AstNode[]
}

export function analyzeTemplateBindings(
  ast: ProgramNode,
  resolve: TemplateSerializeCtx["resolve"],
  callIndex?: ProgramCallIndex
): TemplatePlan | null {
  const bodyNodes = ast.body as AstNode[]

  const analysis: TemplateSerializeCtx = {
    resolve,
    bodyNodes,
    isJsxProd: (node) =>
      isKiruJsxFactoryCall(node, resolve, "jsx") ||
      isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxs: (node) => isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxDev: (node) => isKiruJsxFactoryCall(node, resolve, "jsxDEV"),
  }

  const calls: TemplateShellCallSite[] = []
  if (callIndex) {
    callIndex.forEachCall((site) => {
      const node = site.node
      if (
        (analysis.isJsxProd(node) || analysis.isJsxDev(node)) &&
        isTemplateShellEligibleCall(node, analysis)
      ) {
        calls.push({ node, strictHoledShell: site.fnDepth >= 2 })
      }
    })
  } else {
    walkProgramBody(bodyNodes, {
      onCallExpression: (node, { fnDepth }) => {
        if (
          (analysis.isJsxProd(node) || analysis.isJsxDev(node)) &&
          isTemplateShellEligibleCall(node, analysis)
        ) {
          calls.push({ node, strictHoledShell: fnDepth >= 2 })
        }
      },
    })
  }

  const selected = selectMaximalTemplateShellCalls(calls, analysis)
  if (selected.length === 0) return null

  const { bindings, refVarMap } = planTemplateBindings(
    selected,
    bodyNodes,
    analysis
  )
  if (bindings.length === 0) return null

  const hoistedVarByNode = findHoistedVarNames(bodyNodes, bindings)
  return { bindings, refVarMap, hoistedVarByNode, bodyNodes }
}

export function templatePlanToEdits(
  plan: TemplatePlan,
  source: string,
  deferByNode: Map<AstNode, string>,
  hoistByNode: Map<AstNode, string> = new Map(),
  renderRootVarByBindingNode: Map<AstNode, string> = new Map(),
  renderRootBindingSkipTemplateReplace: Set<AstNode> = new Set()
): CodegenPlan {
  const edits: CodegenPlan["edits"] = [{ kind: "prepend", text: TEMPLATE_IMPORT }]

  const { bindings, refVarMap, hoistedVarByNode, bodyNodes } = plan
  const inline = bindings.filter((b) => !hoistedVarByNode.has(b.node))

  const moduleDecls: string[] = []
  for (const b of bindings) {
    if (hoistedVarByNode.has(b.node)) continue
    moduleDecls.push(templateDecl(b, refVarMap))
  }

  for (const b of inline) {
    if (renderRootBindingSkipTemplateReplace.has(b.node)) continue
    const renderRootVar = renderRootVarByBindingNode.get(b.node)
    edits.push({
      kind: "replace",
      start: b.node.start,
      end: b.node.end,
      text:
        renderRootVar ??
        templateUse(b, source, deferByNode, hoistByNode),
    })
  }

  if (moduleDecls.length > 0) {
    const minStart = Math.min(
      ...bindings
        .filter((b) => !hoistedVarByNode.has(b.node))
        .map((b) => b.node.start)
    )
    let insertPos = 0
    for (const node of bodyNodes) {
      if (node.end <= minStart) insertPos = Math.max(insertPos, node.end)
    }
    edits.push({
      kind: "appendRight",
      pos: insertPos,
      text: `\n${moduleDecls.join("\n")}\n`,
    })
  }

  for (const b of bindings) {
    const hoist = hoistedVarByNode.get(b.node)
    if (!hoist) continue
    edits.push({
      kind: "replace",
      start: hoist.declStart,
      end: hoist.declEnd,
      text: `${b.varName} = ${templateDeclExpr(b, refVarMap)}`,
    })
    const metaRange = findHoistedMetaAssignmentRange(source, hoist.varName)
    if (metaRange) {
      edits.push({
        kind: "replace",
        start: metaRange.start,
        end: metaRange.end,
        text: "",
      })
    }
    const useText = templateUse(b, source, deferByNode, hoistByNode)
    for (const ref of collectIdentifierRefs(
      bodyNodes,
      hoist.varName,
      hoist.idNode
    ).filter(
      (r) =>
        !metaRange ||
        r.start < metaRange.start ||
        r.end > metaRange.end
    )) {
      edits.push({
        kind: "replace",
        start: ref.start,
        end: ref.end,
        text: useText,
      })
    }
  }

  return { edits, imports: emptyCodegenPlan().imports }
}

/** Nodes replaced by template bindings (hoist pass should skip these subtrees). */
export function templateAbsorbedNodes(plan: TemplatePlan | null): Set<AstNode> {
  const nodes = new Set<AstNode>()
  if (!plan) return nodes
  for (const b of plan.bindings) nodes.add(b.node)
  return nodes
}

/** Hole payload nodes that may still be module- or setup-hoisted inside a template shell. */
export function templateHoleNodes(plan: TemplatePlan | null): Set<AstNode> {
  const nodes = new Set<AstNode>()
  if (!plan) return nodes
  for (const b of plan.bindings) {
    for (const n of b.holeNodes) {
      nodes.add(n)
      if (n.type === "ArrayExpression") {
        for (const elem of (n as { elements?: (AstNode | null)[] }).elements ??
          []) {
          if (elem) nodes.add(elem)
        }
      }
    }
  }
  return nodes
}

export function buildTemplateCodegenPlan(
  ast: ProgramNode,
  source: string,
  resolve: TemplateSerializeCtx["resolve"],
  deferByNode: Map<AstNode, string>,
  hoistByNode: Map<AstNode, string> = new Map()
): CodegenPlan {
  const analyzed = analyzeTemplateBindings(ast, resolve)
  if (!analyzed) return emptyCodegenPlan()
  return templatePlanToEdits(analyzed, source, deferByNode, hoistByNode)
}

/** @deprecated Use buildTemplateCodegenPlan via jsxHoistPipeline */
export function prepareJSXTemplates(ctx: TransformCTX): void {
  const source = ctx.code.toString()
  const bodyNodes = ctx.ast.body as AstNode[]
  const resolve = buildProgramBindingResolve(bodyNodes)
  const plan = buildTemplateCodegenPlan(ctx.ast, source, resolve, new Map())
  applyCodegenPlan(ctx.code, plan)
}

function planTemplateBindings(
  selected: {
    call: AstNode
    result: {
      html: string
      holeCount: number
      holeNodes: AstNode[]
      regions: CompileRegion[]
      bindings: import("kiru/template").TemplateBindingDescriptor[]
      bindingHosts: TemplateBindingHost[]
    }
  }[],
  bodyNodes: AstNode[],
  analysis: TemplateSerializeCtx
): { bindings: TemplateBinding[]; refVarMap: Map<string, string> } {
  let bindings: TemplateBinding[] = selected.map((s, i) => ({
    node: s.call,
    html: s.result.html,
    holeCount: s.result.holeCount,
    holeNodes: s.result.holeNodes,
    regions: s.result.regions,
    bindings: s.result.bindings,
    bindingHosts: s.result.bindingHosts,
    structuralNodeCount: s.result.structuralNodeCount,
    structuralWalk: s.result.structuralWalk,
    varName: `$t${i}`,
  }))

  const refNames = new Set<string>()
  for (const b of bindings) {
    for (const name of parseTemplateRefMarkers(b.html)) refNames.add(name)
  }

  for (const name of refNames) {
    const hasRenderBinding = bindings.some((b) =>
      bindingMatchesComponentRender(b.node, name, bodyNodes, analysis)
    )
    if (hasRenderBinding) continue
    const leaf = serializeComponentLeafTemplate(name, analysis, (jsx) =>
      serializeJsxCallToTemplate(jsx, analysis)
    )
    if (!leaf) continue
    const renderInit = findComponentRenderJsxNode(name, bodyNodes)
    bindings.push({
      node: renderInit ?? bindings[0]!.node,
      html: leaf.html,
      holeCount: 0,
      holeNodes: [],
      regions: [],
      bindings: [],
      bindingHosts: [],
      structuralNodeCount: leaf.structuralNodeCount,
      structuralWalk: leaf.structuralWalk,
      varName: `$t${bindings.length}`,
    })
  }

  bindings.sort((a, b) => {
    const aLeaf = a.holeCount === 0 && !htmlUsesTemplateRefs(a.html)
    const bLeaf = b.holeCount === 0 && !htmlUsesTemplateRefs(b.html)
    if (aLeaf && !bLeaf) return -1
    if (bLeaf && !aLeaf) return 1
    return a.node.start - b.node.start
  })

  bindings = bindings.map((b, i) => ({ ...b, varName: `$t${i}` }))

  const refVarMap = new Map<string, string>()
  for (const name of refNames) {
    const match = bindings.find(
      (b) =>
        b.holeCount === 0 &&
        (bindingMatchesComponentRender(b.node, name, bodyNodes, analysis) ||
          serializeComponentLeafTemplate(name, analysis, (jsx) =>
            serializeJsxCallToTemplate(jsx, analysis)
          )?.html === b.html)
    )
    if (match) refVarMap.set(name, match.varName)
  }

  return { bindings, refVarMap }
}

function findComponentRenderJsxNode(
  componentName: string,
  bodyNodes: AstNode[]
): AstNode | null {
  for (const stmt of bodyNodes) {
    const init = findBindingInitInStmt(stmt, componentName)
    if (!init) continue
    if (
      init.type === "ArrowFunctionExpression" ||
      init.type === "FunctionExpression"
    ) {
      const body = (init as { body?: AstNode }).body
      if (body?.type === "CallExpression") return body
      if (body?.type === "BlockStatement") {
        const stmts = (body as { body?: AstNode[] }).body
        const ret = stmts?.find((s) => s.type === "ReturnStatement")
        const arg = (ret as { argument?: AstNode } | undefined)?.argument
        if (arg?.type === "CallExpression") return arg
      }
    }
  }
  return null
}

function findBindingInitInStmt(stmt: AstNode, name: string): AstNode | null {
  if (stmt.type === "VariableDeclaration") {
    for (const decl of (stmt as { declarations?: AstNode[] }).declarations ?? []) {
      const id = (decl as { id?: AstNode }).id
      if (id?.type === "Identifier" && id.name === name) {
        return (decl as { init?: AstNode }).init ?? null
      }
    }
  }
  if (stmt.type === "ExportNamedDeclaration") {
    const decl = (stmt as { declaration?: AstNode }).declaration
    if (decl) return findBindingInitInStmt(decl, name)
  }
  return null
}

function exprTextForTemplateHole(
  source: string,
  node: AstNode,
  deferByNode: Map<AstNode, string>,
  hoistByNode: Map<AstNode, string>
): string {
  if (node.type === "ArrayExpression") {
    const parts: string[] = []
    for (const elem of (node as { elements?: (AstNode | null)[] }).elements ??
      []) {
        if (!elem) continue
        parts.push(exprTextForTemplateHole(source, elem, deferByNode, hoistByNode))
      }
    return `[${parts.join(", ")}]`
  }
  const hoisted = hoistByNode.get(node)
  if (hoisted !== undefined) return hoisted
  return sliceNode(source, node, deferByNode)
}

function templateDecl(b: TemplateBinding, refVarMap: Map<string, string>): string {
  return `const ${b.varName} = ${templateDeclExpr(b, refVarMap)}`
}

function templateDeclExpr(
  b: TemplateBinding,
  refVarMap: Map<string, string>
): string {
  return buildTemplateFactoryExpr(
    b.html,
    b.holeCount,
    refVarMap,
    b.structuralNodeCount,
    b.structuralWalk
  )
}

function templateUse(
  b: TemplateBinding,
  source: string,
  deferByNode: Map<AstNode, string>,
  hoistByNode: Map<AstNode, string>
): string {
  if (b.holeCount === 0) return b.varName
  const parts = b.holeNodes.map((n) =>
    exprTextForTemplateHole(source, n, deferByNode, hoistByNode)
  )
  const regionsLit = formatRegionsLiteral(b.regions)
  const regionsArg = regionsLit ? `, ${regionsLit}` : ""
  const bindingsLit = formatTemplateBindingsLiteral(b.bindings)
  const bindingsArg = bindingsLit ? `, ${bindingsLit}` : ""
  const payloadsLit = formatBindingPayloadsLiteral(
    formatBindingPayloadSlots(
      b.bindingHosts,
      source,
      deferByNode,
      hoistByNode
    )
  )
  const payloadsArg = payloadsLit ? `, ${payloadsLit}` : ""
  return `createHoledTemplate(${b.varName}, [${parts.join(", ")}]${regionsArg}${bindingsArg}${payloadsArg})`
}

export function formatBindingPayloadSlots(
  hosts: TemplateBindingHost[],
  source: string,
  deferByNode: Map<AstNode, string>,
  hoistByNode: Map<AstNode, string>
): string[] {
  if (hosts.length === 0) return []
  const max = Math.max(...hosts.map((h) => h.nodeIndex))
  const slots = Array.from({ length: max + 1 }, () => "undefined")
  for (const host of hosts) {
    slots[host.nodeIndex] = behaviorPropsObjectExpr(
      source,
      host.call,
      deferByNode,
      hoistByNode
    )
  }
  return slots
}

function behaviorPropsObjectExpr(
  source: string,
  callNode: AstNode,
  deferByNode: Map<AstNode, string>,
  hoistByNode: Map<AstNode, string>
): string {
  const propsArg = callNode.arguments?.[1]
  if (propsArg?.type !== "ObjectExpression") return "{}"
  const parts: string[] = []
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") continue
    const key =
      prop.key?.type === "Identifier" && prop.key.name
        ? prop.key.name
        : prop.key?.type === "Literal" && typeof prop.key.value === "string"
          ? prop.key.value
          : undefined
    if (!key) continue
    if (
      key !== "ref" &&
      !key.startsWith("on") &&
      !key.startsWith("bind:")
    ) {
      continue
    }
    const value = prop.value as AstNode
    const hoisted = hoistByNode.get(value)
    const expr =
      hoisted !== undefined ? hoisted : sliceNode(source, value, deferByNode)
    const keyText = key.startsWith("bind:") ? `"${key}"` : key
    parts.push(`${keyText}: ${expr}`)
  }
  return `{${parts.join(", ")}}`
}

function findHoistedVarNames(
  bodyNodes: AstNode[],
  bindings: TemplateBinding[]
): Map<AstNode, HoistedVarBinding> {
  const byNode = new Map(bindings.map((b) => [b.node, b] as const))
  const out = new Map<AstNode, HoistedVarBinding>()

  for (const stmt of bodyNodes) {
    visitModuleAst([stmt], (node) => {
      if (node.type !== "VariableDeclaration") return
      for (const decl of node.declarations ?? []) {
        if (decl.type !== "VariableDeclarator") continue
        const id = decl.id
        const init = decl.init as AstNode | undefined
        if (id?.type !== "Identifier" || !id.name || !init) continue
        if (!/^\$k\d+$/.test(id.name)) continue
        if (byNode.has(init)) {
          out.set(init, {
            varName: id.name,
            declStart: decl.start,
            declEnd: decl.end,
            idNode: id as AstNode,
          })
        }
      }
    })
  }
  return out
}

function findHoistedMetaAssignmentRange(
  source: string,
  varName: string
): { start: number; end: number } | null {
  const pattern = new RegExp(`\\n${varName.replace(/\$/g, "\\$")}\\.meta=\\{[^\\n]*\\}`, "g")
  const match = pattern.exec(source)
  if (!match) return null
  return { start: match.index, end: match.index + match[0].length }
}

function collectIdentifierRefs(
  bodyNodes: AstNode[],
  name: string,
  excludeId: AstNode
): { start: number; end: number }[] {
  const refs: { start: number; end: number }[] = []
  visitModuleAst(bodyNodes, (node) => {
    if (node.type !== "Identifier" || node.name !== name) return
    if (node === excludeId) return
    refs.push({ start: node.start, end: node.end })
  })
  return refs
}

function visitModuleAst(nodes: AstNode[], fn: (n: AstNode) => void): void {
  const visit = (node: AstNode | null | undefined) => {
    if (!node || typeof node !== "object" || !("type" in node)) return
    fn(node)
    for (const key of Object.keys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key]
      if (Array.isArray(val)) {
        for (const c of val) visit(c as AstNode)
      } else if (val && typeof val === "object" && "type" in val) {
        visit(val as AstNode)
      }
    }
  }
  for (const n of nodes) visit(n)
}
