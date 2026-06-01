import type { ProgramNode } from "rollup"
import { buildProgramBindingResolve } from "../scopeWalk.js"
import { isKiruJsxFactoryCall } from "../scope.js"
import type { TemplateSerializeCtx } from "../templateHTML.js"
import type * as AST from "../ast.js"

type AstNode = AST.AstNode

export function createDomSerializeCtx(
  ast: ProgramNode
): TemplateSerializeCtx & { bodyNodes: AstNode[] } {
  const bodyNodes = ast.body as AstNode[]
  const resolve = buildProgramBindingResolve(bodyNodes)
  return {
    bodyNodes,
    resolve,
    domCodegen: true,
    isJsxProd: (node) => isKiruJsxFactoryCall(node, resolve, "jsx"),
    isJsxs: (node) => isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxDev: (node) => isKiruJsxFactoryCall(node, resolve, "jsxDEV"),
  }
}

function isDomForBinding(
  resolve: (name: string) => import("../scope.js").BindingInfo | null
): boolean {
  return (name: string) => {
    const binding = resolve(name)
    if (binding?.import?.imported !== "For") return false
    const src = binding.import.source ?? ""
    return src === "kiru/dom" || src.endsWith("/kiru/dom")
  }
}

export function isForCall(
  node: AstNode,
  resolve: (name: string) => import("../scope.js").BindingInfo | null
): boolean {
  if (isForJsxCall(node, resolve)) return true
  if (node.type !== "CallExpression") return false
  const callee = node.callee as AstNode
  if (callee?.type !== "Identifier" || !callee.name) return false
  return isDomForBinding(resolve)(callee.name)
}

export function isForJsxCall(
  node: AstNode,
  resolve: (name: string) => import("../scope.js").BindingInfo | null
): boolean {
  if (
    !isKiruJsxFactoryCall(node, resolve, "jsx") &&
    !isKiruJsxFactoryCall(node, resolve, "jsxs") &&
    !isKiruJsxFactoryCall(node, resolve, "jsxDEV")
  ) {
    return false
  }
  const typeArg = node.arguments?.[0]
  if (typeArg?.type !== "Identifier" || !typeArg.name) return false
  return isDomForBinding(resolve)(typeArg.name)
}

export function isCreateComponentCall(
  node: AstNode,
  resolve: (name: string) => import("../scope.js").BindingInfo | null
): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee as AstNode
  if (callee?.type !== "Identifier" || !callee.name) return false
  const binding = resolve(callee.name)
  return binding?.import?.imported === "createComponent"
}
