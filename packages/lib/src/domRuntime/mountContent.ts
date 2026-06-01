import { isComponentHandle } from "./component.js"
import type { DomMountContent, DomMountNode } from "./types.js"

export function normalizeMountContent(
  content: DomMountContent | null | undefined
): DomMountNode[] {
  if (content == null) return []
  if (Array.isArray(content)) return content.slice() as DomMountNode[]
  return [content as DomMountNode]
}

export function mountNodeRoot(node: DomMountNode): Element {
  if (isComponentHandle(node)) {
    return node.getRoot() as Element
  }
  return node as Element
}

export function mountRoots(content: DomMountContent): Element[] {
  return normalizeMountContent(content).map(mountNodeRoot)
}

export function disposeMountNode(node: DomMountNode): void {
  if (isComponentHandle(node)) {
    node.dispose()
  } else {
    const el = node as Element
    if (el.isConnected) {
      el.remove()
    }
  }
}

export function disposeMountContent(content: DomMountContent): void {
  for (const node of normalizeMountContent(content)) {
    disposeMountNode(node)
  }
}

export function insertMountNodes(
  container: Element,
  roots: Element[],
  before: Comment
): void {
  for (const root of roots) {
    container.insertBefore(root, before)
  }
}

export function mountManyBefore(anchor: Node, nodes: DomMountNode[]): void {
  const parent = anchor.parentNode
  if (!parent) {
    throw new Error("[kiru/dom]: mountManyBefore anchor must be connected")
  }
  for (const node of nodes) {
    parent.insertBefore(mountNodeRoot(node), anchor)
  }
}

export function isMountContentArray(
  value: unknown
): value is readonly DomMountNode[] {
  return Array.isArray(value)
}
