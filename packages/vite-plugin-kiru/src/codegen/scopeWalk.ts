import * as AST from "./ast.js"
import type { AstNode, WalkContext } from "./ast.js"
import {
  ScopeStack,
  bindingKindAtDepth,
  buildModuleImportScope,
  declareFunctionParamBindings,
  registerImportDeclaration,
  type BindingInfo,
} from "./scope.js"

export type ScopeWalkContext = {
  resolve: (name: string) => BindingInfo | null
  fnDepth: number
  parent: () => AstNode | null
  grandparent: () => AstNode | null
  /** Ancestors for the node being visited (excludes that node). */
  readonly stack: readonly AstNode[]
} & Pick<
  WalkContext,
  "exit" | "exitBranch" | "skipDescent" | "walkArguments" | "walkChild"
>

export type ScopeWalkHooks = {
  onCallExpression?: (node: AstNode, ctx: ScopeWalkContext) => void
  onArrayExpression?: (node: AstNode, ctx: ScopeWalkContext) => void
}

/** Resolve bindings after walking imports, functions, and nested scopes. */
export function buildProgramBindingResolve(
  bodyNodes: AstNode[]
): (name: string) => BindingInfo | null {
  const scope = walkProgramBody(bodyNodes, {})
  return (name: string) => scope.resolve(name)
}

function toScopeWalkContext(
  walkCtx: WalkContext,
  resolve: (name: string) => BindingInfo | null,
  fnDepth: number
): ScopeWalkContext {
  return {
    resolve,
    fnDepth,
    stack: walkCtx.stack,
    parent: () => walkCtx.parent(),
    grandparent: () => walkCtx.grandparent(),
    exit: walkCtx.exit,
    exitBranch: walkCtx.exitBranch,
    skipDescent: walkCtx.skipDescent,
    walkArguments: walkCtx.walkArguments,
    walkChild: walkCtx.walkChild,
  }
}

function createScopedProgramVisitor(
  scope: ScopeStack,
  fnDepthRef: { current: number },
  hooks: ScopeWalkHooks
): AST.AstVisitor {
  const resolve = (name: string) => scope.resolve(name)

  const enterFunction = (node: AstNode) => {
    fnDepthRef.current++
    scope.push()
    declareFunctionParamBindings(
      (node as { params?: AstNode[] }).params,
      scope,
      fnDepthRef.current >= 2 ? "renderLocal" : "param"
    )
    return () => {
      scope.pop()
      fnDepthRef.current--
    }
  }

  const visitor: AST.AstVisitor = {
    ImportDeclaration: (node, ctx) => {
      if (fnDepthRef.current === 0) {
        registerImportDeclaration(node, scope)
      }
      ctx.skipDescent()
    },

    FunctionDeclaration: (node) => enterFunction(node),
    FunctionExpression: (node) => enterFunction(node),
    ArrowFunctionExpression: (node) => enterFunction(node),

    VariableDeclaration: (node) => {
      for (const decl of node.declarations ?? []) {
        if (decl.type !== "VariableDeclarator") continue
        const id = decl.id
        if (id?.type === "Identifier" && id.name) {
          scope.declare(id.name, {
            kind: bindingKindAtDepth(
              fnDepthRef.current,
              decl.init as AstNode,
              resolve
            ),
            name: id.name,
          })
        }
      }
    },

    CallExpression: (node, ctx) => {
      hooks.onCallExpression?.(
        node,
        toScopeWalkContext(ctx, resolve, fnDepthRef.current)
      )
      ctx.walkArguments(node)
      ctx.skipDescent()
    },

    ArrayExpression: (node, ctx) => {
      hooks.onArrayExpression?.(
        node,
        toScopeWalkContext(ctx, resolve, fnDepthRef.current)
      )
    },

    ExportNamedDeclaration: (node, ctx) => {
      if (node.declaration) {
        AST.walk(node.declaration, visitor)
      }
      ctx.skipDescent()
    },

    ExportDefaultDeclaration: (node, ctx) => {
      if (node.declaration) {
        AST.walk(node.declaration, visitor)
      }
      ctx.skipDescent()
    },
  }

  return visitor
}

/** Walk module body with lexical scope (imports, functions, blocks, setup/render). */
export function walkProgramBody(
  bodyNodes: AstNode[],
  hooks: ScopeWalkHooks
): ScopeStack {
  const scope = buildModuleImportScope(bodyNodes)
  const fnDepthRef = { current: 0 }
  const visitor = createScopedProgramVisitor(scope, fnDepthRef, hooks)

  for (const stmt of bodyNodes) {
    if (stmt.type === "ImportDeclaration") {
      registerImportDeclaration(stmt, scope)
      continue
    }
    AST.walk(stmt, visitor)
  }
  return scope
}
