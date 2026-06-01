import { isComponentHandle } from "./component.js"
import type { ComponentHandle } from "./types.js"

export function resolveRoot(content: ComponentHandle | Element): Element | Comment {
  return isComponentHandle(content) ? content.getRoot() : content
}

export function mountBefore(
  anchor: Node,
  content: ComponentHandle | Element
): void {
  const parent = anchor.parentNode
  if (!parent) {
    throw new Error("[kiru/dom]: mountBefore anchor must be connected")
  }
  parent.insertBefore(resolveRoot(content), anchor)
}

export function mountAfter(
  anchor: Node,
  content: ComponentHandle | Element
): void {
  const parent = anchor.parentNode
  if (!parent) {
    throw new Error("[kiru/dom]: mountAfter anchor must be connected")
  }
  parent.insertBefore(resolveRoot(content), anchor.nextSibling)
}

export function replaceChildren(parent: Element, ...nodes: Element[]): void {
  parent.replaceChildren(...nodes)
}
