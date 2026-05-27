import type { AstNode } from "./ast.js"
import type { BindingInfo } from "./scope.js"
import { ScopeStack, walkProgramBody, type ScopeWalkContext } from "./scopeWalk.js"

export type CallSiteRecord = {
  node: AstNode
  resolve: (name: string) => BindingInfo | null
  setupInsertBefore: AstNode | null
  componentInsertBefore: AstNode | null
  fnDepth: number
  stack: readonly AstNode[]
}

export type ArraySiteRecord = {
  node: AstNode
  resolve: (name: string) => BindingInfo | null
  parent: AstNode | null
  grandparent: AstNode | null
}

export type ProgramCallIndex = {
  scope: ScopeStack
  moduleHoistInits: Set<number>
  getCall(start: number): CallSiteRecord | undefined
  getArray(start: number): ArraySiteRecord | undefined
  callsContainedIn(outer: AstNode): CallSiteRecord[]
  forEachCall(fn: (site: CallSiteRecord) => void): void
  forEachArray(fn: (site: ArraySiteRecord) => void): void
}

export type BuildProgramCallIndexHooks = {
  onCallExpression?: (site: CallSiteRecord) => void
  onArrayExpression?: (site: ArraySiteRecord) => void
}

function nodeContains(outer: AstNode, inner: AstNode): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

function unwrapExpression(node: AstNode | undefined): AstNode | undefined {
  let current = node
  while (current) {
    if (current.type === "ParenthesizedExpression") {
      current = (current as { expression?: AstNode }).expression
      continue
    }
    if (current.type === "ExpressionStatement") {
      current = (current as { expression?: AstNode }).expression
      continue
    }
    break
  }
  return current
}

function isRenderBodySingleExpression(
  body: AstNode | undefined,
  exprNode: AstNode
): boolean {
  if (!body) return false
  const unwrapped = unwrapExpression(body)
  if (unwrapped === exprNode) return true
  if (unwrapped?.type === "BlockStatement") {
    const stmts = (unwrapped as { body?: AstNode[] }).body
    if (stmts?.length === 1 && stmts[0]?.type === "ReturnStatement") {
      return unwrapExpression(stmts[0].argument) === exprNode
    }
  }
  return false
}

export function findSetupRenderInsertBefore(
  renderExprNode: AstNode,
  walkCtx: Pick<ScopeWalkContext, "fnDepth" | "stack">
): AstNode | null {
  if (walkCtx.fnDepth < 2) return null
  for (const n of walkCtx.stack) {
    if (n.type !== "ReturnStatement") continue
    const renderFn = (n as { argument?: AstNode }).argument
    if (!renderFn || renderFn.type !== "ArrowFunctionExpression") continue
    const renderParams = (renderFn as { params?: AstNode[] }).params ?? []
    if (renderParams.length > 0) continue
    const body = (renderFn as { body?: AstNode }).body
    if (!isRenderBodySingleExpression(body, renderExprNode)) continue
    return n
  }
  return null
}

export function findComponentRenderRootInsertBefore(
  renderExprNode: AstNode,
  walkCtx: Pick<ScopeWalkContext, "fnDepth" | "stack">
): AstNode | null {
  if (walkCtx.fnDepth !== 1) return null
  for (const n of walkCtx.stack) {
    if (n.type !== "ReturnStatement") continue
    const arg = unwrapExpression((n as { argument?: AstNode }).argument)
    if (arg === renderExprNode) return n
  }
  return null
}

export function callSiteWalkContext(
  site: CallSiteRecord
): Pick<ScopeWalkContext, "resolve" | "fnDepth" | "stack" | "parent" | "grandparent"> {
  const stack = site.stack
  return {
    resolve: site.resolve,
    fnDepth: site.fnDepth,
    stack,
    parent: () => stack[stack.length - 1] ?? null,
    grandparent: () => stack[stack.length - 2] ?? null,
  }
}

export function buildProgramCallIndex(
  bodyNodes: AstNode[],
  hooks: BuildProgramCallIndexHooks = {}
): ProgramCallIndex {
  const callsByStart = new Map<number, CallSiteRecord>()
  const arraysByStart = new Map<number, ArraySiteRecord>()
  const callsInOrder: CallSiteRecord[] = []
  const arraysInOrder: ArraySiteRecord[] = []
  const moduleHoistInits = new Set<number>()

  const scope = walkProgramBody(bodyNodes, {
    onVariableDeclarator: (decl, ctx) => {
      if (ctx.fnDepth !== 0) return
      const id = decl.id
      const init = decl.init as AstNode | undefined
      if (id?.type !== "Identifier" || !id.name || !init) return
      if (!/^\$k\d+$/.test(id.name)) return
      if (init.type === "CallExpression") moduleHoistInits.add(init.start)
    },
    onCallExpression: (node, walkCtx) => {
      const site: CallSiteRecord = {
        node,
        resolve: walkCtx.resolve,
        setupInsertBefore: findSetupRenderInsertBefore(node, walkCtx),
        componentInsertBefore: findComponentRenderRootInsertBefore(node, walkCtx),
        fnDepth: walkCtx.fnDepth,
        stack: walkCtx.stack,
      }
      callsByStart.set(node.start, site)
      callsInOrder.push(site)
      hooks.onCallExpression?.(site)
    },
    onArrayExpression: (node, walkCtx) => {
      const site: ArraySiteRecord = {
        node,
        resolve: walkCtx.resolve,
        parent: walkCtx.parent(),
        grandparent: walkCtx.grandparent(),
      }
      arraysByStart.set(node.start, site)
      arraysInOrder.push(site)
      hooks.onArrayExpression?.(site)
    },
  })

  return {
    scope,
    moduleHoistInits,
    getCall: (start) => callsByStart.get(start),
    getArray: (start) => arraysByStart.get(start),
    callsContainedIn: (outer) =>
      callsInOrder.filter((site) => nodeContains(outer, site.node)),
    forEachCall: (fn) => {
      for (const site of callsInOrder) fn(site)
    },
    forEachArray: (fn) => {
      for (const site of arraysInOrder) fn(site)
    },
  }
}

export function programResolve(
  index: ProgramCallIndex
): (name: string) => BindingInfo | null {
  return (name: string) => index.scope.resolve(name)
}
