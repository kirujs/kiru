interface AstNodeId {
  type: string
  name: string
}

const types = [
  "BinaryExpression",
  "ImportDefaultSpecifier",
  "ExportNamedDeclaration",
  "ExportDefaultDeclaration",
  "FunctionDeclaration",
  "FunctionExpression",
  "BlockStatement",
  "ReturnStatement",
  "CallExpression",
  "Identifier",
  "Literal",
  "VariableDeclaration",
  "VariableDeclarator",
  "ArrowFunctionExpression",
  "ExpressionStatement",
  "UpdateExpression",
  "MemberExpression",
  "ChainExpression",
  "AssignmentExpression",
  "ArrayExpression",
  "ObjectExpression",
  "SequenceExpression",
  "Property",
] as const

export function isAstExpression(
  node: AstNode | string | number | boolean | null | undefined
): node is AstNode {
  return node != null && typeof node === "object" && "type" in node
}

export interface AstNode {
  start: number
  end: number
  type: (typeof types)[number] | (string & {})
  body?: AstNode | AstNode[]
  declaration?: AstNode
  declarations?: AstNode[]
  expression?: AstNode
  expressions?: AstNode[]
  id?: AstNodeId
  init?: AstNode
  object?: AstNodeId
  property?: AstNodeId
  properties?: AstNode[]
  argument?: AstNode
  arguments?: AstNode[]
  specifiers?: AstNode[]
  cases?: AstNode[]
  name?: string
  raw?: string
  callee?: AstNode
  exported?: AstNode & { name: string }
  consequent?: AstNode | AstNode[]
  alternate?: AstNode
  local?: AstNode & { name: string }
  imported?: AstNode & { name: string }
  source?: AstNode & { value: string }
  key?: AstNode
  /** `Property` expression child, or `Literal` primitive payload. */
  value?: AstNode | string | number | boolean | null
  /** ESTree `Property` — method shorthand in object literals. */
  method?: boolean
  shorthand?: boolean
  left?: AstNode
  right?: AstNode
  test?: AstNode
  /** `ArrayExpression` element slots (may contain `null` holes). */
  elements?: (AstNode | null)[]
}

export function findNode(
  node: AstNode,
  predicate: (node: AstNode) => boolean,
  maxDepth = Infinity
): AstNode | null {
  let res: AstNode | null = null
  walk(node, {
    "*": (node, ctx) => {
      if (predicate(node)) {
        res = node
        ctx.exit()
      }
      if (ctx.stack.length >= maxDepth) ctx.exitBranch()
    },
  })
  return res
}

type VisitorCTX = {
  stack: AstNode[]
  exit: () => never
  exitBranch: () => never
}
type VisitorNodeCallback = (
  node: AstNode,
  ctx: VisitorCTX
) => void | (() => void)

type AstVisitor = {
  [key in AstNode["type"]]?: VisitorNodeCallback
} & {
  "*"?: VisitorNodeCallback
}

export function walk(
  node: AstNode,
  visitorOrCallback: AstVisitor | VisitorNodeCallback
) {
  const visitor =
    typeof visitorOrCallback === "function"
      ? { "*": visitorOrCallback }
      : visitorOrCallback
  const ctx: VisitorCTX = {
    stack: [],
    exit: exitWalk,
    exitBranch: exitBranch,
  }
  try {
    walk_impl(node, visitor, ctx)
  } catch (error) {
    if (error === "walk:exit") return
    throw error
  }
}

const exitWalk = () => {
  throw "walk:exit"
}
const exitBranch = () => {
  throw "walk:exit-branch"
}

const flushCallbacks = (callbacks: (() => void)[]) => {
  while (callbacks.length) {
    callbacks.pop()!()
  }
}

function walk_impl(node: AstNode, visitor: AstVisitor, ctx: VisitorCTX) {
  const onExitCallbacks: (() => void)[] = []
  try {
    {
      const cb = visitor[node.type]?.(node, ctx)
      if (cb instanceof Function) onExitCallbacks.push(cb)
    }
    {
      const cb = visitor["*"]?.(node, ctx)
      if (cb instanceof Function) onExitCallbacks.push(cb)
    }
  } catch (error) {
    if (error === "walk:exit-branch") {
      flushCallbacks(onExitCallbacks)
      return
    }
    throw error
  }

  ctx.stack.push(node)
  walkChildFields(node, visitor, ctx)
  ctx.stack.pop()
  flushCallbacks(onExitCallbacks)
}

const walkChildKeys = [
  "arguments",
  "declarations",
  "properties",
  "property",
  "cases",
  "body",
  "consequent",
  "init",
  "argument",
  "alternate",
  "callee",
  "declaration",
  "expression",
  "expressions",
  "test",
  "left",
  "right",
  "object",
] as const satisfies readonly (keyof AstNode)[]

function walkChildFields(
  node: AstNode,
  visitor: AstVisitor,
  ctx: VisitorCTX
): void {
  const descend = (val: unknown) => {
    if (!val) return
    if (Array.isArray(val)) {
      for (const c of val) {
        if (c && typeof c === "object" && "type" in c) {
          walk_impl(c as AstNode, visitor, ctx)
        }
      }
      return
    }
    if (typeof val === "object" && "type" in val) {
      walk_impl(val as AstNode, visitor, ctx)
    }
  }
  for (const key of walkChildKeys) descend(node[key])
  if (node.type === "ArrayExpression") {
    for (const c of node.elements ?? []) {
      if (c && typeof c === "object" && "type" in c) walk_impl(c, visitor, ctx)
    }
  }
  if (
    node.type === "Property" &&
    node.value != null &&
    typeof node.value === "object" &&
    "type" in node.value
  ) {
    walk_impl(node.value as AstNode, visitor, ctx)
  }
}
