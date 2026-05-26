import type { AstNode } from "./ast.js"
import {
  ScopeStack,
  bindingKindAtDepth,
  buildModuleImportScope,
  declareFunctionParamBindings,
  registerImportDeclaration,
  type BindingInfo,
} from "./scope.js"

export type ScopeWalkHooks = {
  onCallExpression?: (
    node: AstNode,
    ctx: { resolve: (name: string) => BindingInfo | null; fnDepth: number }
  ) => void
}

/** Resolve bindings after walking imports, functions, and nested scopes. */
export function buildProgramBindingResolve(
  bodyNodes: AstNode[]
): (name: string) => BindingInfo | null {
  const scope = walkProgramBody(bodyNodes, {})
  return (name: string) => scope.resolve(name)
}

/** Walk module body with lexical scope (imports, functions, blocks, setup/render). */
export function walkProgramBody(
  bodyNodes: AstNode[],
  hooks: ScopeWalkHooks
): ScopeStack {
  const scope = buildModuleImportScope(bodyNodes)
  const resolve = (name: string) => scope.resolve(name)
  let fnDepth = 0

  const enterFunction = (node: AstNode) => {
    fnDepth++
    scope.push()
    declareFunctionParamBindings(
      (node as { params?: AstNode[] }).params,
      scope,
      fnDepth >= 2 ? "renderLocal" : "param"
    )
  }

  const exitFunction = () => {
    scope.pop()
    fnDepth--
  }

  const walkStmt = (node: AstNode) => {
    if (!node || typeof node !== "object" || !("type" in node)) return

    if (node.type === "ImportDeclaration" && fnDepth === 0) {
      registerImportDeclaration(node, scope)
      return
    }

    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      enterFunction(node)
      const body = (node as { body?: AstNode }).body
      if (body?.type === "BlockStatement") {
        for (const stmt of (body.body as AstNode[]) ?? []) walkStmt(stmt)
      } else if (body) {
        walkExpr(body)
      }
      exitFunction()
      return
    }

    if (node.type === "VariableDeclaration") {
      for (const decl of node.declarations ?? []) {
        if (decl.type !== "VariableDeclarator") continue
        const id = decl.id
        if (id?.type === "Identifier" && id.name) {
          scope.declare(id.name, {
            kind: bindingKindAtDepth(fnDepth, decl.init as AstNode, resolve),
            name: id.name,
          })
        }
        if (decl.init) walkExpr(decl.init as AstNode)
      }
      return
    }

    if (node.type === "ReturnStatement") {
      const arg = node.argument
      if (
        arg &&
        (arg.type === "ArrowFunctionExpression" ||
          arg.type === "FunctionExpression")
      ) {
        enterFunction(arg)
        const renderBody = (arg as { body?: AstNode }).body
        if (renderBody?.type === "BlockStatement") {
          for (const stmt of (renderBody.body as AstNode[]) ?? []) walkStmt(stmt)
        } else if (renderBody) {
          walkExpr(renderBody)
        }
        exitFunction()
        return
      }
      if (arg) walkExpr(arg)
      return
    }

    if (node.type === "ExportNamedDeclaration" && node.declaration) {
      walkStmt(node.declaration)
      return
    }
    if (node.type === "ExportDefaultDeclaration" && node.declaration) {
      walkStmt(node.declaration)
      return
    }

    if (node.type === "ExpressionStatement" && node.expression) {
      walkExpr(node.expression as AstNode)
    }
  }

  const walkExpr = (node: AstNode) => {
    if (!node || typeof node !== "object" || !("type" in node)) return

    if (
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression"
    ) {
      enterFunction(node)
      const body = (node as { body?: AstNode }).body
      if (body?.type === "BlockStatement") {
        for (const stmt of (body.body as AstNode[]) ?? []) walkStmt(stmt)
      } else if (body) {
        walkExpr(body)
      }
      exitFunction()
      return
    }

    if (node.type === "CallExpression") {
      hooks.onCallExpression?.(node, { resolve, fnDepth })
      for (const arg of node.arguments ?? []) {
        if (arg) walkExpr(arg)
      }
      return
    }
    walkExprChildren(node)
  }

  const walkExprChildren = (node: AstNode) => {
    for (const key of [
      "arguments",
      "properties",
      "elements",
      "expressions",
      "left",
      "right",
      "callee",
      "object",
      "property",
    ] as const) {
      const val = node[key]
      if (!val) continue
      if (Array.isArray(val)) {
        for (const c of val) {
          if (c && typeof c === "object" && "type" in c) walkExpr(c as AstNode)
        }
      } else if (typeof val === "object" && "type" in val) {
        walkExpr(val as AstNode)
      }
    }
    if (
      node.type === "Property" &&
      node.value != null &&
      typeof node.value === "object" &&
      "type" in node.value
    ) {
      walkExpr(node.value as AstNode)
    }
  }

  for (const stmt of bodyNodes) {
    if (stmt.type === "ImportDeclaration") {
      registerImportDeclaration(stmt, scope)
      continue
    }
    walkStmt(stmt)
  }
  return scope
}
