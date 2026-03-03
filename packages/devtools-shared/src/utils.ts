import type { AppHandle } from "kiru"
import { devtoolsState } from "./state"

export function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}

export function getNodeName(node: Kiru.VNode) {
  return (
    (node.type as any).displayName ??
    ((node.type as Function).name || "Anonymous Function")
  )
}

const $DEV_FILE_LINK = Symbol.for("kiru.devFileLink")
export function getFileLink(value: unknown): string | null {
  try {
    return (value as any)[$DEV_FILE_LINK] ?? null
  } catch {
    return null
  }
}

export function isDevtoolsApp(app: AppHandle) {
  return app.name === "kiru.devtools"
}

type InferredMapEntries<T> = T extends Map<infer K, infer V> ? [K, V][] : never

export function typedMapEntries<T extends Map<any, any>>(
  map: T
): InferredMapEntries<T> {
  return Array.from(map.entries()) as InferredMapEntries<T>
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function trapFocus(
  e: KeyboardEvent,
  element: Element | ShadowRoot,
  activeElement: Element | null
) {
  if (e.key === "Tab") {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    if (
      activeElement &&
      !element.contains(activeElement) &&
      firstElement &&
      firstElement instanceof HTMLElement
    ) {
      return firstElement.focus()
    }
    if (e.shiftKey) {
      if (
        activeElement === firstElement &&
        lastElement instanceof HTMLElement
      ) {
        lastElement.focus()
        e.preventDefault()
      }
    } else {
      if (
        activeElement === lastElement &&
        firstElement instanceof HTMLElement
      ) {
        firstElement.focus()
        e.preventDefault()
      }
    }
  }
}

export function devtoolsAppRootHasFocus() {
  return devtoolsState.rootRef.value?.matches(":focus-within, :focus")
}

export function ifDevtoolsAppRootHasFocus<T>(callback: (el: Element) => T) {
  const root = devtoolsState.rootRef.value
  if (root?.matches(":focus-within, :focus")) {
    return callback(root)
  }
  return null
}

export function computeComponentHash(component: Kiru.VNode): string {
  const segments: string[] = []
  let n: Kiru.VNode | null = component
  while (n) {
    if (typeof n.type === "function") {
      const anyType = n.type as any
      const name =
        anyType.displayName ??
        ((anyType as Function).name || "AnonymousFunction")
      const key =
        n.key != null && n.key !== undefined
          ? `k:${String(n.key)}`
          : `i:${n.index}`
      segments.push(`${name}[${key}]`)
    }
    n = n.parent
  }
  return `ch:${segments.join("/")}`
}

export function findComponentByHash(
  root: Kiru.VNode | null,
  targetHash: string
): Kiru.VNode | null {
  if (!root) return null
  const stack: Kiru.VNode[] = [root]
  while (stack.length) {
    const node = stack.pop()!
    if (typeof node.type === "function") {
      if (computeComponentHash(node) === targetHash) {
        return node
      }
    }
    if (node.child) stack.push(node.child)
    if (node.sibling) stack.push(node.sibling)
  }
  return null
}
