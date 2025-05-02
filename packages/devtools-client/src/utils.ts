import type { AppContext } from "kaioken"
import { isFragment, isLazy } from "../../lib/dist/utils.js"

export function isDevtoolsApp(app: AppContext) {
  return app.name === "kaioken.devtools"
}

export function getNodeName(node: Kaioken.VNode) {
  return (
    (node.type as any).displayName ??
    ((node.type as Function).name || "Anonymous Function")
  )
}

export function searchMatchesItem(terms: string[], item: string) {
  const toLower = item.toLowerCase()
  return terms.every((term) => toLower.includes(term))
}

export function isComponent(
  node: Kaioken.VNode
): node is Kaioken.VNode & { type: Function } {
  return typeof node.type === "function" && !isFragment(node) && !isLazy(node)
}

export function nodeContainsComponent(node: Kaioken.VNode) {
  let stack = [node]
  while (stack.length) {
    const n = stack.pop()!
    if (isComponent(n)) {
      return true
    }
    n.child && stack.push(n.child)
    n.sibling && stack.push(n.sibling)
  }
  return false
}

export const nodeContainsNode = (
  currentNode: Kaioken.VNode,
  componentNode: Kaioken.VNode
) => {
  const stack = [componentNode.parent]

  while (stack.length) {
    const node = stack.pop()

    if (currentNode === node) {
      return true
    }

    if (node?.parent) stack.push(node.parent)
  }

  return false
}

export function applyObjectChangeFromKeys(
  obj: Record<string, any>,
  keys: string[],
  value: unknown
) {
  let o = obj
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (i === keys.length - 1) {
      o[key] = value
    } else {
      o = o[key]
    }
  }
}

interface TreeNode {
  sibling?: TreeNode
  child?: TreeNode
}

export function cloneTree<T extends TreeNode>(
  tree: T | undefined,
  predicate: (node: T) => boolean
): (T & { ref: T }) | undefined {
  // Base case: if the node is undefined, return undefined
  if (!tree) {
    return undefined
  }

  // Clone the current node if its name starts with 'a'
  const shouldCloneCurrentNode = predicate(tree)

  // Recursively clone sibling and child nodes that start with 'a'
  const clonedSibling = cloneTree<T>(tree.sibling as T | undefined, predicate)
  const clonedChild = cloneTree<T>(tree.child as T | undefined, predicate)

  // If the current node doesn't start with 'a' but has valid cloned descendants,
  // we need to return the first valid descendant
  if (!shouldCloneCurrentNode) {
    // If there's a cloned sibling, return it
    if (clonedSibling) {
      return clonedSibling
    }
    // If there's a cloned child, return it
    if (clonedChild) {
      return clonedChild
    }
    // No valid nodes to clone in this branch
    return undefined
  }

  // Clone the current node and attach cloned descendants
  return {
    ref: tree,
    sibling: clonedSibling,
    child: clonedChild,
  } as T & { ref: T }
}
