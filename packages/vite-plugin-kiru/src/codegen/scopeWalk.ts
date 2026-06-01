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
  onVariableDeclarator?: (decl: AstNode, ctx: ScopeWalkContext) => void
}

/** Resolve bindings after walking imports, functions, and nested scopes. */
export function buildProgramBindingResolve(
  bodyNodes: AstNode[]
): (name: string) => BindingInfo | null {
  const accumulated = new Map<string, BindingInfo>()
  walkProgramBody(bodyNodes, {
    onVariableDeclarator(decl, ctx) {
      const id = decl.id
      if (id?.type === "Identifier" && id.name) {
        accumulated.set(id.name, {
          kind: bindingKindAtDepth(
            ctx.fnDepth,
            decl.init as AstNode,
            ctx.resolve
          ),
          name: id.name,
        })
      }
    },
  })

  const captureParams = (node: AstNode, fnDepth: number) => {
    for (const param of (node as { params?: AstNode[] }).params ?? []) {
      if (param.type === "Identifier" && param.name) {
        accumulated.set(param.name, {
          kind: fnDepth >= 2 ? "renderLocal" : "param",
          name: param.name,
        })
      }
    }
  }

  const paramVisitor: AST.AstVisitor = {
    FunctionDeclaration: (node) => captureParams(node, 1),
    FunctionExpression: (node) => captureParams(node, 2),
    ArrowFunctionExpression: (node) => captureParams(node, 2),
  }
  for (const stmt of bodyNodes) {
    AST.walk(stmt, paramVisitor)
  }

  const moduleScope = buildModuleImportScope(bodyNodes)
  for (const stmt of bodyNodes) {
    if (stmt.type === "ImportDeclaration") {
      registerImportDeclaration(stmt, moduleScope)
    }
  }

  return (name: string) =>
    accumulated.get(name) ?? moduleScope.resolve(name)
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

  const predeclareFunctionBodyBindings = (node: AstNode): void => {
    const body = (node as { body?: AstNode }).body
    if (!body || body.type !== "BlockStatement") return
    const statements = (body as { body?: AstNode[] }).body ?? []
    for (const stmt of statements) {
      if (stmt.type === "FunctionDeclaration") {
        const id = (stmt as { id?: AstNode }).id
        if (id?.type === "Identifier" && id.name) {
          scope.declare(id.name, {
            kind: bindingKindAtDepth(fnDepthRef.current, undefined, resolve),
            name: id.name,
          })
        }
        continue
      }
      if (stmt.type !== "VariableDeclaration") continue
      for (const decl of stmt.declarations ?? []) {
        if (decl.type !== "VariableDeclarator") continue
        const id = decl.id
        if (id?.type !== "Identifier" || !id.name) continue
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
  }

  const enterFunction = (node: AstNode) => {
    fnDepthRef.current++
    scope.push()
    declareFunctionParamBindings(
      (node as { params?: AstNode[] }).params,
      scope,
      fnDepthRef.current >= 2 ? "renderLocal" : "param"
    )
    // Predeclare function-body bindings so call-site resolver snapshots are
    // lexical-scope complete even before traversal reaches each declaration.
    predeclareFunctionBodyBindings(node)
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

    VariableDeclaration: (node, ctx) => {
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
        hooks.onVariableDeclarator?.(
          decl,
          toScopeWalkContext(ctx, resolve, fnDepthRef.current)
        )
      }
    },

    CallExpression: (node, ctx) => {
      hooks.onCallExpression?.(
        node,
        toScopeWalkContext(ctx, scope.snapshotResolve(), fnDepthRef.current)
      )
      ctx.walkArguments(node)
      ctx.skipDescent()
    },

    ArrayExpression: (node, ctx) => {
      hooks.onArrayExpression?.(
        node,
        toScopeWalkContext(ctx, scope.snapshotResolve(), fnDepthRef.current)
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
