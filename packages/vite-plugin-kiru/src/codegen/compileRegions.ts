import type { CompileRegion, CompileRegionKind } from "kiru/template"
import * as AST from "./ast.js"
import {
  blocksModuleHoist,
  isKiruJsxFactoryCall,
  isModuleSignalBinding,
  isStaticLiteral,
  type BindingInfo,
} from "./scope.js"

type AstNode = AST.AstNode

export type RegionAnalysisCtx = {
  resolve: (name: string) => BindingInfo | null
  isJsxProd: (node: AstNode) => boolean
  isJsxs: (node: AstNode) => boolean
  isJsxDev: (node: AstNode) => boolean
}

export function formatRegionsLiteral(regions: readonly CompileRegion[]): string {
  if (regions.length === 0) return ""
  const parts = regions.map((r) => {
    const fields: string[] = [`kind:"${r.kind}"`]
    if (r.anchor !== undefined) fields.push(`anchor:${r.anchor}`)
    if (r.slot !== undefined) fields.push(`slot:${r.slot}`)
    return `{${fields.join(",")}}`
  })
  return `[${parts.join(",")}]`
}

export function classifyTemplateHoleRegion(
  node: AstNode,
  ctx: RegionAnalysisCtx,
  anchor: number
): CompileRegion {
  return { ...classifyChildSlotRegion(node, ctx), anchor }
}

export function classifyJsxSlotRegion(
  node: AstNode,
  ctx: RegionAnalysisCtx,
  slot: number
): CompileRegion {
  return { ...classifyChildSlotRegion(node, ctx), slot }
}

function classifyChildSlotRegion(
  node: AstNode,
  ctx: RegionAnalysisCtx
): Pick<CompileRegion, "kind"> {
  if (node.type === "Identifier" && node.name === "children") {
    return { kind: "children" }
  }
  if (node.type === "ConditionalExpression") {
    return { kind: "conditional" }
  }
  if (node.type === "LogicalExpression") {
    return { kind: "conditional" }
  }
  if (node.type === "ArrayExpression") {
    if (isRegionEligibleChildArray(node, ctx)) {
      return { kind: "fragment" }
    }
    if (arrayExpressionHasMixedTextAndBinding(node, ctx)) {
      return { kind: "text" }
    }
  }
  if (node.type === "CallExpression" && isAnyJsxFactoryCall(node, ctx)) {
    const typeArg = node.arguments?.[0]
    if (typeArg?.type === "Literal" && typeof typeArg.value === "string") {
      return { kind: "insert" }
    }
    return { kind: "component" }
  }
  if (isTextBindingExpression(node, ctx)) {
    return { kind: "text" }
  }
  return { kind: "insert" }
}

function isTextBindingExpression(node: AstNode, ctx: RegionAnalysisCtx): boolean {
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
    return true
  }
  if (isReactiveSignalRead(node, ctx)) return true
  if (node.type === "Identifier" && node.name) {
    const binding = ctx.resolve(node.name)
    if (isModuleSignalBinding(binding)) return true
    if (binding?.kind === "setupConst") return true
  }
  if (node.type === "CallExpression") {
    if (isReactiveSignalRead(node, ctx)) return true
  }
  return false
}

function isAnyJsxFactoryCall(
  callNode: AstNode,
  ctx: RegionAnalysisCtx
): boolean {
  return (
    isKiruJsxFactoryCall(callNode, ctx.resolve, "jsx") ||
    isKiruJsxFactoryCall(callNode, ctx.resolve, "jsxs") ||
    isKiruJsxFactoryCall(callNode, ctx.resolve, "jsxDEV")
  )
}

function isReactiveSignalRead(node: AstNode, ctx: RegionAnalysisCtx): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee as AstNode
  if (callee?.type !== "MemberExpression") return false
  const prop = (callee as { property?: AstNode }).property
  if (prop?.type !== "Identifier" || prop.name !== "call") return false
  const obj = (callee as { object?: AstNode }).object
  if (obj?.type !== "Identifier" || !obj.name) return false
  const binding = ctx.resolve(obj.name)
  return isModuleSignalBinding(binding) || binding?.kind === "setupConst"
}

function arrayExpressionHasMixedTextAndBinding(
  node: AstNode,
  ctx: RegionAnalysisCtx
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

function isRegionEligibleChildArray(
  node: AstNode,
  ctx: RegionAnalysisCtx
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
      const typeArg = elem.arguments?.[0]
      if (typeArg?.type === "Literal" && typeof typeArg.value === "string") {
        hasFullyInlinedJsx = true
      } else {
        hasHole = true
      }
      continue
    }
    return false
  }
  if (hasHole && hasFullyInlinedJsx) return false
  return hasHole
}

export function getCompileRegionsForJsxs(
  callNode: AstNode,
  ctx: RegionAnalysisCtx
): CompileRegion[] | null {
  if (!ctx.isJsxs(callNode) && !ctx.isJsxDev(callNode)) return null

  if (ctx.isJsxDev(callNode)) {
    const isStaticChildrenArg = callNode.arguments?.[3]
    if (
      isStaticChildrenArg?.type !== "Literal" ||
      isStaticChildrenArg.value !== true
    ) {
      return null
    }
  }

  const elems = getChildrenArrayElements(callNode.arguments?.[1])
  if (!elems?.length) return null

  const regions: CompileRegion[] = []
  for (let i = 0; i < elems.length; i++) {
    const elem = elems[i] as AstNode
    if (isDynamicChildSlot(elem, ctx)) {
      regions.push(classifyJsxSlotRegion(elem, ctx, i))
    }
  }
  if (regions.length === 0 || regions.length === elems.length) return null
  return regions
}

function getChildrenArrayElements(
  propsArg: AstNode | undefined | null
): (AstNode | null)[] | null {
  if (!propsArg || propsArg.type !== "ObjectExpression") return null
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") continue
    const keyName =
      prop.key?.name ??
      (typeof prop.key?.value === "string" ? prop.key.value : undefined)
    if (keyName !== "children") continue
    const value = prop.value as AstNode
    if (value?.type === "ArrayExpression") {
      return (value as { elements?: (AstNode | null)[] }).elements ?? []
    }
  }
  return null
}

function isDynamicChildSlot(
  node: AstNode | null | undefined,
  ctx: RegionAnalysisCtx
): boolean {
  if (!node) return false
  if (node.type === "Identifier") {
    const name = node.name
    if (!name || name === "undefined") return false
    const binding = ctx.resolve(name)
    if (isModuleSignalBinding(binding)) return true
    if (binding?.kind === "setupConst") return true
    return binding != null && blocksModuleHoist(binding)
  }
  if (isStaticLiteral(node)) return false
  if (node.type === "CallExpression") {
    if (isAnyJsxFactoryCall(node, ctx)) {
      return jsxFactoryCallHasDynamicChildSlot(node, ctx)
    }
    if (isReactiveSignalRead(node, ctx)) return true
    return true
  }
  if (node.type === "ConditionalExpression" || node.type === "LogicalExpression") {
    return true
  }
  if (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression"
  ) {
    return true
  }
  return true
}

function jsxFactoryCallHasDynamicChildSlot(
  callNode: AstNode,
  ctx: RegionAnalysisCtx
): boolean {
  if (ctx.isJsxs(callNode)) {
    const regions = getCompileRegionsForJsxs(callNode, ctx)
    return regions !== null && regions.length > 0
  }
  if (ctx.isJsxDev(callNode)) {
    const isStaticChildrenArg = callNode.arguments?.[3]
    if (
      isStaticChildrenArg?.type === "Literal" &&
      isStaticChildrenArg.value === true
    ) {
      const regions = getCompileRegionsForJsxs(callNode, ctx)
      return regions !== null && regions.length > 0
    }
  }
  const propsArg = callNode.arguments?.[1]
  if (!propsArg || propsArg.type !== "ObjectExpression") return false
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") continue
    const keyName =
      prop.key?.name ??
      (typeof prop.key?.value === "string" ? prop.key.value : undefined)
    if (keyName !== "children") continue
    const value = prop.value as AstNode
    if (!value) return false
    if (value.type === "ArrayExpression") {
      const elems = (value as { elements?: (AstNode | null)[] }).elements ?? []
      return elems.some((e) => e && isDynamicChildSlot(e as AstNode, ctx))
    }
    return isDynamicChildSlot(value, ctx)
  }
  return false
}
