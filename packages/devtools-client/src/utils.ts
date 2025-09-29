import { isFragment, isLazy, isMemo } from "kiru/utils"

export function getNodeName(node: Kiru.VNode) {
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
  node: Kiru.VNode
): node is Kiru.VNode & { type: Function } {
  return (
    typeof node.type === "function" &&
    !isFragment(node) &&
    !isLazy(node) &&
    !isMemo(node)
  )
}

export function nodeContainsComponent(node: Kiru.VNode) {
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
  currentNode: Kiru.VNode,
  componentNode: Kiru.VNode
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

interface TreeNode {
  sibling: TreeNode | null
  child: TreeNode | null
}

export function cloneTree<T extends TreeNode>(
  tree: T | null,
  predicate: (node: T) => boolean
): (T & { ref: T }) | null {
  // Base case: if the node is undefined, return undefined
  if (!tree) {
    return null
  }

  // Clone the current node if its name starts with 'a'
  const shouldCloneCurrentNode = predicate(tree)

  // Recursively clone sibling and child nodes that start with 'a'
  const clonedSibling = cloneTree<T>(tree.sibling as T | null, predicate)
  const clonedChild = cloneTree<T>(tree.child as T | null, predicate)

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
    return null
  }

  // Clone the current node and attach cloned descendants
  return {
    ref: tree,
    sibling: clonedSibling ?? null,
    child: clonedChild ?? null,
  } as T & { ref: T }
}
