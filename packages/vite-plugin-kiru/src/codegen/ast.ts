type AstNodeId =
  | {
      type: "Identifier"
      name: string
    }
  | {
      type: "ArrayPattern"
      elements: {
        type: "Identifier"
        name: string
      }[]
    }
  | {
      type: "ObjectPattern"
      properties: {
        type: "Property"
        key: {
          type: "Identifier"
          name: string
        }
        value: {
          type: "Identifier"
          name: string
        }
      }[]
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
  value?: AstNode
  shorthand?: boolean
  left?: AstNode
  right?: AstNode
  params?: AstNode[]
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
interface NodeVisitorCTX {
  stack: AstNode[]
  exit: () => never
  exitBranch: () => never
}
export type NodeVisitorCallback = (
  node: AstNode,
  ctx: NodeVisitorCTX
) => void | (() => void)

type AstVisitorMap = {
  [key in AstNode["type"]]?: NodeVisitorCallback
} & {
  "*"?: NodeVisitorCallback
}

export function walk(node: AstNode, visitor: AstVisitorMap) {
  const ctx: NodeVisitorCTX = {
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

function walk_impl(node: AstNode, visitor: AstVisitorMap, ctx: NodeVisitorCTX) {
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
  ;[
    node.arguments,
    node.declarations,
    node.properties,
    node.object,
    node.property,
    node.cases,
    node.body,
    node.consequent,
    node.init,
    node.argument,
    node.alternate,
    node.callee,
    node.declaration,
    node.expression,
    node.expressions,
    node.left,
    node.right,
  ]
    .filter(Boolean)
    .forEach((a) => {
      if (Array.isArray(a)) {
        for (let i = 0; i < a.length; i++) {
          walk_impl(a![i], visitor, ctx)
        }
        return
      }
      if (typeof a === "object" && "type" in a) {
        walk_impl(a as AstNode, visitor, ctx)
        return
      }
    })

  // only walk 'value' of Property nodes
  if (
    node.type === "Property" &&
    node.value &&
    typeof node.value === "object"
  ) {
    walk_impl(node.value as AstNode, visitor, ctx)
  }

  ctx.stack.pop()
  flushCallbacks(onExitCallbacks)
}
