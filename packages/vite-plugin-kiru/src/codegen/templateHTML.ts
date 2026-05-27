import type { CompileRegion } from "kiru/template"
import {
  encodeStaticText,
  KIRU_HOLE_MARKER,
  serializeStaticElementToHtml,
} from "kiru/utils"
import * as AST from "./ast.js"
import { classifyTemplateHoleRegion } from "./compileRegions.js"
import {
  KIRU_TEMPLATE_REF_PREFIX,
  tryFoldStaticComponentHtml,
} from "./componentFold.js"
import {
  blocksModuleHoist,
  isKiruJsxFactoryCall,
  isStaticLiteral,
  type BindingInfo,
} from "./scope.js"

type AstNode = AST.AstNode

export type TemplateSerializeCtx = {
  resolve: (name: string) => BindingInfo | null
  isJsxProd: (node: AstNode) => boolean
  isJsxs: (node: AstNode) => boolean
  isJsxDev: (node: AstNode) => boolean
  /** Module body — used to resolve static component folds. */
  bodyNodes?: readonly AstNode[]
  /** When true, reject holed shells with no static text (nested render fns). */
  strictHoledShell?: boolean
}

export type TemplateSerializeResult = {
  html: string
  holeCount: number
  /** Dynamic child expression nodes (for codegen source slices). */
  holeNodes: AstNode[]
  regions: CompileRegion[]
}

function isAnyJsxFactoryCall(
  callNode: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  return (
    isKiruJsxFactoryCall(callNode, ctx.resolve, "jsx") ||
    isKiruJsxFactoryCall(callNode, ctx.resolve, "jsxs") ||
    isKiruJsxFactoryCall(callNode, ctx.resolve, "jsxDEV")
  )
}

/** Fully static subtree — eligible for zero-hole template. */
export function isTemplateEligibleCall(
  callNode: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (!isAnyJsxFactoryCall(callNode, ctx)) return false
  if (!isTemplateShellEligibleJsxCall(callNode, ctx)) return false
  if (expressionReferencesBlockedBinding(callNode, ctx)) return false
  if (subtreeHasImpureCallInStaticRegions(callNode, ctx)) return false
  const typeArg = callNode.arguments?.[0]
  if (
    !typeArg ||
    typeArg.type !== "Literal" ||
    typeof typeArg.value !== "string"
  ) {
    return false
  }
  const propsArg = callNode.arguments?.[1]
  if (!isTemplateProps(propsArg, ctx)) return false
  return true
}

/** Static shell (may include dynamic child holes). */
export function isTemplateShellEligibleCall(
  callNode: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (!isAnyJsxFactoryCall(callNode, ctx)) return false
  return isTemplateShellEligibleJsxCall(callNode, ctx)
}

export function serializeJsxCallToHtml(
  callNode: AstNode,
  ctx: TemplateSerializeCtx
): string | null {
  const result = serializeJsxCallToTemplate(callNode, ctx)
  if (!result || result.holeCount > 0) return null
  return result.html
}

/** True when serialized shell HTML includes static text (not holes/tags only). */
export function shellHtmlHasStaticContent(html: string): boolean {
  if (html.includes(KIRU_TEMPLATE_REF_PREFIX)) return true
  const withoutHoles = html.replaceAll(KIRU_HOLE_MARKER, "")
  return /<[^>]+>[^<\s]/.test(withoutHoles)
}

/**
 * True when the shell has static markup beside holes (e.g. `<div><button>Toggle</button><!--#--></div>`).
 * Hole-only shells (`<div><!--#--></div>`) stay ineligible under strictHoledShell.
 */
export function shellHtmlHasStaticMarkupBesideHoles(html: string): boolean {
  if (html.includes(KIRU_TEMPLATE_REF_PREFIX)) return false
  const marked = html.replaceAll(KIRU_HOLE_MARKER, "\0")
  return /<[a-z][\w-]*[^>]*>[^<\0\s]/.test(marked)
}

export function serializeJsxCallToTemplate(
  callNode: AstNode,
  ctx: TemplateSerializeCtx
): TemplateSerializeResult | null {
  if (!isAnyJsxFactoryCall(callNode, ctx)) return null
  if (!isTemplateShellEligibleJsxCall(callNode, ctx)) return null
  const typeArg = callNode.arguments?.[0]
  if (
    !typeArg ||
    typeArg.type !== "Literal" ||
    typeof typeArg.value !== "string"
  ) {
    return null
  }
  const tag = typeArg.value as string
  const propsArg = callNode.arguments?.[1]
  const holeNodes: AstNode[] = []
  const regions: CompileRegion[] = []
  const props = collectStaticProps(propsArg, ctx)
  const innerHtml = serializeChildrenToInnerHtml(
    propsArg,
    ctx,
    holeNodes,
    regions
  )
  const html = serializeStaticElementToHtml(tag, props, innerHtml)
  if (
    ctx.strictHoledShell &&
    holeNodes.length > 0 &&
    !shellHtmlHasStaticContent(html) &&
    !shellHtmlHasStaticMarkupBesideHoles(html)
  ) {
    return null
  }
  return { html, holeCount: holeNodes.length, holeNodes, regions }
}

/** Serialize-first, then outermost among successful shells (failed parents do not suppress children). */
export type TemplateShellCallSite = {
  node: AstNode
  strictHoledShell: boolean
}

export function selectMaximalTemplateShellCalls(
  calls: TemplateShellCallSite[],
  ctx: TemplateSerializeCtx
): { call: AstNode; result: TemplateSerializeResult }[] {
  const serializable = new Map<AstNode, TemplateSerializeResult>()
  for (const { node: call, strictHoledShell } of calls) {
    const result = serializeJsxCallToTemplate(call, {
      ...ctx,
      strictHoledShell,
    })
    if (result) serializable.set(call, result)
  }
  const maximal = filterOutermostShellCalls([...serializable.keys()])
  return maximal
    .sort((a, b) => a.start - b.start)
    .map((call) => ({ call, result: serializable.get(call)! }))
}

function isTemplateShellEligibleJsxCall(
  callNode: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (
    !isKiruJsxFactoryCall(callNode, ctx.resolve, "jsx") &&
    !isKiruJsxFactoryCall(callNode, ctx.resolve, "jsxs") &&
    !isKiruJsxFactoryCall(callNode, ctx.resolve, "jsxDEV")
  ) {
    return false
  }
  const propsArg = callNode.arguments?.[1]
  if (!isTemplateShellProps(propsArg, ctx)) return false
  const keyArg = callNode.arguments?.[2]
  if (!isAbsentOrStaticJsxKeyArg(keyArg)) return false
  if (isKiruJsxFactoryCall(callNode, ctx.resolve, "jsxDEV")) {
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
    if (selfArg && !isTemplateJsxDevSelfArg(selfArg)) return false
  }
  return true
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

function isTemplateJsxDevSelfArg(node: AstNode): boolean {
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

function isTemplateShellProps(
  propsArg: AstNode | undefined | null,
  ctx: TemplateSerializeCtx
): boolean {
  if (!propsArg) return true
  if (propsArg.type === "Literal") {
    return propsArg.value === null || propsArg.value === undefined
  }
  if (propsArg.type !== "ObjectExpression") return false
  const usesInnerHTML = propsHasInnerHTML(propsArg)
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") return false
    const key = propKeyName(prop)
    if (
      !key ||
      key === "ref" ||
      key.startsWith("on") ||
      key.startsWith("bind:")
    ) {
      return false
    }
    const value = prop.value as AstNode
    if (key === "children") {
      if (usesInnerHTML) continue
      if (!isShellChildSlot(value, ctx)) return false
    } else if (key === "innerHTML") {
      if (!isShellInnerHTMLValue(value, ctx)) return false
    } else if (!isTemplatePropValue(value, ctx)) {
      return false
    }
  }
  return true
}

function isTemplatePropValue(
  value: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (isStaticLiteral(value)) return true
  if (value.type === "Identifier" && value.name) {
    const binding = ctx.resolve(value.name)
    return binding?.kind === "moduleStatic"
  }
  return false
}

/** Props for a fully static (zero-hole) template subtree. */
function isTemplateProps(
  propsArg: AstNode | undefined | null,
  ctx: TemplateSerializeCtx
): boolean {
  if (!propsArg) return true
  if (propsArg.type === "Literal") {
    return propsArg.value === null || propsArg.value === undefined
  }
  if (propsArg.type !== "ObjectExpression") return false
  const usesInnerHTML = propsHasInnerHTML(propsArg)
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") return false
    const key = propKeyName(prop)
    if (
      !key ||
      key === "ref" ||
      key.startsWith("on") ||
      key.startsWith("bind:")
    ) {
      return false
    }
    const value = prop.value as AstNode
    if (key === "children") {
      if (usesInnerHTML) continue
      if (!isTemplateChildValue(value, ctx)) return false
    } else if (key === "innerHTML") {
      if (!isTemplateInnerHTMLValue(value, ctx)) return false
    } else if (!isTemplatePropValue(value, ctx)) {
      return false
    }
  }
  return true
}

function isTemplateChildValue(
  node: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (!node) return true
  if (node.type === "CallExpression") {
    return isTemplateEligibleCall(node, ctx)
  }
  if (node.type === "ArrayExpression") {
    for (const elem of (node as { elements?: (AstNode | null)[] }).elements ??
      []) {
      if (!elem) continue
      if (!isTemplateChildValue(elem, ctx)) return false
    }
    return true
  }
  return isStaticLiteral(node)
}

function isShellChildSlot(node: AstNode, ctx: TemplateSerializeCtx): boolean {
  if (isStaticLiteral(node)) return true
  if (node.type === "CallExpression" && isAnyJsxFactoryCall(node, ctx)) {
    return true
  }
  return !isAnyJsxFactoryCall(node, ctx)
}

function propsHasInnerHTML(propsArg: AstNode | undefined | null): boolean {
  if (propsArg?.type !== "ObjectExpression") return false
  return (propsArg.properties ?? []).some(
    (p) => p.type === "Property" && propKeyName(p) === "innerHTML"
  )
}

function findObjectPropValue(
  propsArg: AstNode | undefined | null,
  name: string
): AstNode | undefined {
  if (propsArg?.type !== "ObjectExpression") return undefined
  const prop = (propsArg.properties ?? []).find(
    (p) => p.type === "Property" && propKeyName(p) === name
  )
  return prop?.value as AstNode | undefined
}

/** Matches headlessRender: presence of `innerHTML` wins over `children`. */
function isShellInnerHTMLValue(
  node: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (isStaticLiteral(node)) return true
  if (node.type === "Identifier") {
    if (!node.name || node.name === "undefined") return true
    const binding = ctx.resolve(node.name)
    return (
      binding?.kind === "moduleStatic" || binding?.kind === "moduleSignal"
    )
  }
  return !isAnyJsxFactoryCall(node, ctx)
}

function isTemplateInnerHTMLValue(
  node: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (isStaticLiteral(node)) {
    const v = node.value
    return (
      v === null ||
      v === undefined ||
      typeof v === "string" ||
      typeof v === "number"
    )
  }
  return isTemplatePropValue(node, ctx)
}

function collectStaticProps(
  propsArg: AstNode | undefined | null,
  ctx: TemplateSerializeCtx
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!propsArg || propsArg.type !== "ObjectExpression") return out
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") continue
    const key = propKeyName(prop)
    if (
      !key ||
      key === "children" ||
      key === "innerHTML" ||
      key === "key" ||
      key === "ref"
    ) {
      continue
    }
    const value = resolveStaticPropValue(prop.value as AstNode, ctx)
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

function serializeChildrenToInnerHtml(
  propsArg: AstNode | undefined | null,
  ctx: TemplateSerializeCtx,
  holeNodes: AstNode[],
  regions: CompileRegion[]
): string {
  if (propsHasInnerHTML(propsArg)) {
    return serializeInnerHTMLValue(
      findObjectPropValue(propsArg, "innerHTML"),
      ctx,
      holeNodes,
      regions
    )
  }
  const childrenNode = findObjectPropValue(propsArg, "children")
  if (!childrenNode) return ""
  return serializeChildInner(childrenNode, ctx, holeNodes, regions)
}

function pushTemplateHole(
  node: AstNode,
  ctx: TemplateSerializeCtx,
  holeNodes: AstNode[],
  regions: CompileRegion[]
): void {
  const anchor = holeNodes.length
  holeNodes.push(node)
  regions.push(classifyTemplateHoleRegion(node, ctx, anchor))
}

function mergeInnerTemplateHoles(
  inner: TemplateSerializeResult,
  holeNodes: AstNode[],
  regions: CompileRegion[]
): void {
  const base = holeNodes.length
  for (let i = 0; i < inner.holeNodes.length; i++) {
    holeNodes.push(inner.holeNodes[i]!)
    const r = inner.regions[i]!
    regions.push({ ...r, anchor: base + (r.anchor ?? i) })
  }
}

function serializeInnerHTMLValue(
  node: AstNode | undefined,
  ctx: TemplateSerializeCtx,
  holeNodes: AstNode[],
  regions: CompileRegion[]
): string {
  if (!node) return ""
  if (isStaticLiteral(node)) {
    const v = node.value
    if (v === null || v === undefined) return ""
    return encodeStaticText(String(v))
  }
  if (node.type === "Identifier" && node.name === "undefined") return ""
  if (node.type === "Identifier" && node.name) {
    const binding = ctx.resolve(node.name)
    if (binding?.kind === "moduleStatic") {
      return ""
    }
  }
  pushTemplateHole(node, ctx, holeNodes, regions)
  return KIRU_HOLE_MARKER
}

/** Mixed text arrays like `["Items: ", props.items]` — template as one hole, not partial static text. */
function arrayExpressionHasMixedTextAndBinding(
  node: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (node.type !== "ArrayExpression") return false
  const elems = (
    (node as { elements?: (AstNode | null)[] }).elements ?? []
  ).filter(Boolean) as AstNode[]
  let hasStaticLiteral = false
  let hasNonJsxExpr = false
  for (const elem of elems) {
    if (isStaticLiteral(elem)) {
      hasStaticLiteral = true
      continue
    }
    if (elem.type === "CallExpression" && isAnyJsxFactoryCall(elem, ctx)) {
      continue
    }
    hasNonJsxExpr = true
  }
  return hasStaticLiteral && hasNonJsxExpr
}

/** Whether serializing this child would add a template hole (not fully inlined static host). */
function arrayElementWouldProduceHole(
  elem: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (elem.type === "CallExpression" && isAnyJsxFactoryCall(elem, ctx)) {
    const folded = tryFoldStaticComponentHtml(elem, ctx, (jsx) =>
      serializeJsxCallToTemplate(jsx, ctx)
    )
    if (folded) return false
    const inner = serializeJsxCallToTemplate(elem, ctx)
    if (inner && inner.holeCount > 0) return true
    if (inner && inner.holeCount === 0) return false
    return true
  }
  return true
}

/** Contiguous jsx siblings (or static-inlinable host + jsx) → one region hole. */
function isRegionEligibleChildArray(
  node: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (node.type !== "ArrayExpression") return false
  if (arrayExpressionHasMixedTextAndBinding(node, ctx)) return false

  const elems = (
    (node as { elements?: (AstNode | null)[] }).elements ?? []
  ).filter(Boolean) as AstNode[]
  if (elems.length < 2) return false

  let hasHole = false
  let hasFullyInlinedJsx = false
  for (const elem of elems) {
    if (isStaticLiteral(elem)) return false
    if (elem.type === "CallExpression" && isAnyJsxFactoryCall(elem, ctx)) {
      if (arrayElementWouldProduceHole(elem, ctx)) {
        hasHole = true
      } else {
        hasFullyInlinedJsx = true
      }
      continue
    }
    return false
  }
  if (hasHole && hasFullyInlinedJsx) return false
  return hasHole
}

/**
 * Intrinsic host with static children and only event/bind props dynamic — emit static
 * markup and one hole for the jsx call (props/events) at reconcile time.
 */
function trySerializeEventHostShell(
  callNode: AstNode,
  ctx: TemplateSerializeCtx,
  holeNodes: AstNode[],
  regions: CompileRegion[]
): string | null {
  const typeArg = callNode.arguments?.[0]
  if (typeArg?.type !== "Literal" || typeof typeArg.value !== "string") {
    return null
  }
  const propsArg = callNode.arguments?.[1]
  if (!propsArg || propsArg.type !== "ObjectExpression") return null

  let hasEventOrBind = false
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") return null
    const key = propKeyName(prop)
    if (!key || key === "children" || key === "key" || key === "ref") continue
    if (key.startsWith("on") || key.startsWith("bind:")) {
      hasEventOrBind = true
      continue
    }
    if (!isTemplatePropValue(prop.value as AstNode, ctx)) return null
  }
  if (!hasEventOrBind) return null

  const scratchHoles: AstNode[] = []
  const scratchRegions: CompileRegion[] = []
  const innerHtml = serializeChildrenToInnerHtml(
    propsArg,
    ctx,
    scratchHoles,
    scratchRegions
  )
  if (scratchHoles.length > 0) return null

  pushTemplateHole(callNode, ctx, holeNodes, regions)
  const props = collectStaticProps(propsArg, ctx)
  return serializeStaticElementToHtml(typeArg.value as string, props, innerHtml)
}

function serializeChildInner(
  node: AstNode,
  ctx: TemplateSerializeCtx,
  holeNodes: AstNode[],
  regions: CompileRegion[]
): string {
  // Only primitive literals encode as text; isStaticLiteral is also true for arrays/objects.
  if (node.type === "Literal" && isStaticLiteral(node)) {
    return encodeStaticText(String(node.value ?? ""))
  }
  if (node.type === "ConditionalExpression" || node.type === "LogicalExpression") {
    pushTemplateHole(node, ctx, holeNodes, regions)
    return KIRU_HOLE_MARKER
  }
  if (node.type === "CallExpression" && isAnyJsxFactoryCall(node, ctx)) {
    const eventHost = trySerializeEventHostShell(node, ctx, holeNodes, regions)
    if (eventHost) return eventHost
    const folded = tryFoldStaticComponentHtml(node, ctx, (jsx) =>
      serializeJsxCallToTemplate(jsx, ctx)
    )
    if (folded) return folded
    const inner = serializeJsxCallToTemplate(node, ctx)
    if (inner && inner.holeCount === 0) return inner.html
    if (inner && inner.holeCount > 0) {
      mergeInnerTemplateHoles(inner, holeNodes, regions)
      return inner.html
    }
    pushTemplateHole(node, ctx, holeNodes, regions)
    return KIRU_HOLE_MARKER
  }
  if (node.type === "ArrayExpression") {
    if (arrayExpressionHasMixedTextAndBinding(node, ctx)) {
      pushTemplateHole(node, ctx, holeNodes, regions)
      return KIRU_HOLE_MARKER
    }
    if (isRegionEligibleChildArray(node, ctx)) {
      pushTemplateHole(node, ctx, holeNodes, regions)
      return KIRU_HOLE_MARKER
    }
    return ((node as { elements?: (AstNode | null)[] }).elements ?? [])
      .filter(Boolean)
      .map((e) => serializeChildInner(e as AstNode, ctx, holeNodes, regions))
      .join("")
  }
  if (!isAnyJsxFactoryCall(node, ctx)) {
    pushTemplateHole(node, ctx, holeNodes, regions)
    return KIRU_HOLE_MARKER
  }
  return ""
}

function propKeyName(prop: AstNode): string | undefined {
  if (prop.type !== "Property") return undefined
  if (prop.key?.type === "Identifier" && prop.key.name) return prop.key.name
  if (prop.key?.type === "Literal" && typeof prop.key.value === "string") {
    return prop.key.value
  }
  return undefined
}

function resolveStaticPropValue(
  value: AstNode,
  ctx: TemplateSerializeCtx
): string | number | boolean | undefined {
  if (isStaticLiteral(value)) {
    const v = value.value
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      return v
    }
    return String(v ?? "")
  }
  if (value.type === "Identifier" && value.name) {
    const binding = ctx.resolve(value.name)
    if (binding?.kind === "moduleStatic") {
      return undefined
    }
  }
  return undefined
}

function subtreeHasImpureCallInStaticRegions(
  node: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
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

function isImpureCall(node: AstNode, ctx: TemplateSerializeCtx): boolean {
  if (node.type !== "CallExpression") return false
  if (ctx.isJsxProd(node) || ctx.isJsxDev(node)) return false
  const callee = node.callee
  if (callee?.type === "Identifier" && callee.name) {
    const binding = ctx.resolve(callee.name)
    if (binding?.kind === "moduleSignal") return false
  }
  return true
}

function expressionReferencesBlockedBinding(
  node: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  let blocked = false
  AST.walk(node, {
    Identifier: (n, walkCtx) => {
      if (!n.name) return
      const parent =
        walkCtx.stack.length > 0
          ? walkCtx.stack[walkCtx.stack.length - 1]!
          : null

      if (
        parent?.type === "Property" &&
        (parent as { key?: AstNode }).key === n
      ) {
        return
      }
      if (n.name === "this" || n.name === "undefined") return
      const binding = ctx.resolve(n.name)
      if (!binding) {
        blocked = true
        return walkCtx.exit()
      }
      if (blocksModuleHoist(binding)) blocked = true
      if (
        binding.kind !== "import" &&
        binding.kind !== "moduleStatic" &&
        binding.kind !== "moduleSignal"
      ) {
        blocked = true
        return walkCtx.exit()
      }
    },
  })
  return blocked
}

/** Prefer outermost shell templates (absorb inner static markup). */
export function filterOutermostShellCalls(calls: AstNode[]): AstNode[] {
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
