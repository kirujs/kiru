import {
  FLAG_DELETION,
  $FRAGMENT,
  $CONTEXT_PROVIDER,
  FLAG_PLACEMENT,
  FLAG_UPDATE,
  $ERROR_BOUNDARY,
} from "../constants.js"
import { createElement } from "../index.js"
import { KiruError } from "../error.js"
import { node } from "../globals.js"
import type { AppContext } from "../appContext.js"
import type { ErrorBoundaryNode } from "../types.utils.js"
import { isMemoFn } from "../components/memo.js"

export {
  cloneElement,
  isVNodeDeleted,
  isElement,
  isVNode,
  isValidTextChild,
  isExoticType,
  isFragment,
  isLazy,
  isMemo,
  isContextProvider,
  vNodeContains,
  getCurrentVNode,
  getVNodeAppContext,
  commitSnapshot,
  traverseApply,
  findParent,
  findParentErrorBoundary,
  assertValidElementProps,
  normalizeElementKey,
}

function cloneElement(vNode: Kiru.VNode): Kiru.Element {
  const children = vNode.props.children
  let clonedChildren: unknown
  if (isVNode(children)) {
    clonedChildren = cloneElement(children)
  } else if (Array.isArray(children)) {
    clonedChildren = children.map((c) => (isVNode(c) ? cloneElement(c) : c))
  }

  return createElement(vNode.type, { ...vNode.props, children: clonedChildren })
}

function isVNodeDeleted(vNode: Kiru.VNode): boolean {
  return (vNode.flags & FLAG_DELETION) !== 0
}

function isVNode(thing: unknown): thing is Kiru.VNode {
  return typeof thing === "object" && thing !== null && "type" in thing
}

function isElement(thing: unknown): thing is Kiru.Element {
  return typeof thing === "object" && thing !== null && "type" in thing
}

function isValidTextChild(thing: unknown): thing is string | number | bigint {
  return (
    (typeof thing === "string" && thing !== "") ||
    typeof thing === "number" ||
    typeof thing === "bigint"
  )
}

function isExoticType(type: Kiru.VNode["type"]): type is Kiru.ExoticSymbol {
  return (
    type === $FRAGMENT || type === $CONTEXT_PROVIDER || type === $ERROR_BOUNDARY
  )
}

function isFragment(
  vNode: Kiru.VNode
): vNode is Kiru.VNode & { type: typeof $FRAGMENT } {
  return vNode.type === $FRAGMENT
}

function isLazy(vNode: Kiru.VNode): boolean {
  return (
    typeof vNode.type === "function" &&
    "displayName" in vNode.type &&
    vNode.type.displayName === "Kiru.lazy"
  )
}

function isMemo(vNode: Kiru.VNode): boolean {
  return typeof vNode.type === "function" && isMemoFn(vNode.type)
}

function isContextProvider(
  thing: unknown
): thing is Kiru.VNode & { type: typeof $CONTEXT_PROVIDER } {
  return isVNode(thing) && thing.type === $CONTEXT_PROVIDER
}

function getCurrentVNode(): Kiru.VNode | null {
  return node.current
}

function getVNodeAppContext(vNode: Kiru.VNode): AppContext | null {
  let n: Kiru.VNode | null = vNode
  while (n) {
    if (n.app) {
      return (vNode.app = n.app)
    }
    n = n.parent
  }

  return null
}

function commitSnapshot(vNode: Kiru.VNode): void {
  const {
    props: { children, ...props },
    key,
    memoizedProps,
    index,
  } = vNode
  vNode.prev = { props, key, memoizedProps, index }
  vNode.flags &= ~(FLAG_UPDATE | FLAG_PLACEMENT | FLAG_DELETION)
}

function vNodeContains(haystack: Kiru.VNode, needle: Kiru.VNode): boolean {
  if (needle.depth < haystack.depth) return false
  if (haystack === needle) return true
  let checkSiblings = false
  const stack: Kiru.VNode[] = [haystack]
  while (stack.length) {
    const n = stack.pop()!
    if (n === needle) return true
    n.child && stack.push(n.child)
    checkSiblings && n.sibling && stack.push(n.sibling)
    checkSiblings = true
  }
  return false
}

function traverseApply(
  vNode: Kiru.VNode,
  func: (node: Kiru.VNode) => void
): void {
  func(vNode)
  let child = vNode.child
  while (child) {
    func(child)
    if (child.child) {
      traverseApply(child, func)
    }
    child = child.sibling
  }
}

function findParent(vNode: Kiru.VNode, predicate: (n: Kiru.VNode) => boolean) {
  let n: Kiru.VNode | null = vNode.parent
  while (n) {
    if (predicate(n)) return n
    n = n.parent
  }
  return null
}

function findParentErrorBoundary(vNode: Kiru.VNode): ErrorBoundaryNode | null {
  return findParent(
    vNode,
    (n) => n.type === $ERROR_BOUNDARY
  ) as ErrorBoundaryNode | null
}

function assertValidElementProps(vNode: Kiru.VNode) {
  if ("children" in vNode.props && vNode.props.innerHTML) {
    throw new KiruError({
      message: "Cannot use both children and innerHTML on an element",
      vNode,
    })
  }

  for (const key in vNode.props) {
    if ("bind:" + key in vNode.props) {
      throw new KiruError({
        message: `Cannot use both bind:${key} and ${key} on an element`,
        vNode,
      })
    }
  }
}

function normalizeElementKey(thing: unknown): JSX.ElementKey | null {
  if (thing === undefined) return null
  if (typeof thing === "string" || typeof thing === "number") {
    return thing
  }
  return null
}
