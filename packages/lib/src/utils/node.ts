import {
  FLAG_DELETION,
  $FRAGMENT,
  $CONTEXT,
  $ERROR_BOUNDARY,
  $INLINE_FN,
} from "../constants.js"
import { createElement } from "../index.js"
import { KiruError } from "../error.js"
import { node } from "../globals.js"
import type { AppHandle } from "../appHandle.js"

export {
  cloneElement,
  isNodeDeleted,
  isKiruNode,
  isElement,
  isValidTextChild,
  isExoticType,
  isFragment,
  isLazy,
  isContextProvider,
  getCurrentOwner,
  getOwnerApp,
  findParent,
  assertValidElementProps,
  normalizeElementKey,
  createStableId,
  registerCleanup,
  propsChanged,
  getNodeFromDom,
  getAppOwners,
  getOwnerElements,
}

function cloneElement(element: Kiru.Element): Kiru.Element {
  const children = element.props.children
  let clonedChildren: unknown
  if (isKiruNode(children)) {
    clonedChildren = cloneElement(children)
  } else if (Array.isArray(children)) {
    clonedChildren = children.map((child) =>
      isKiruNode(child) ? cloneElement(child) : child
    )
  }

  return createElement(element.type, {
    ...element.props,
    children: clonedChildren,
  })
}

function isNodeDeleted(node: Kiru.KiruNode): boolean {
  return ((node.flags ?? 0) & FLAG_DELETION) !== 0
}

function isKiruNode(thing: unknown): thing is Kiru.KiruNode {
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

function isExoticType(type: Kiru.KiruNode["type"]): type is Kiru.ExoticSymbol {
  return (
    type === $FRAGMENT ||
    type === $CONTEXT ||
    type === $ERROR_BOUNDARY ||
    type === $INLINE_FN
  )
}

function isFragment(
  ownerNode: Kiru.KiruNode
): ownerNode is Kiru.KiruNode & { type: typeof $FRAGMENT } {
  return ownerNode.type === $FRAGMENT
}

function isLazy(ownerNode: Kiru.KiruNode): boolean {
  return (
    typeof ownerNode.type === "function" &&
    "displayName" in ownerNode.type &&
    ownerNode.type.displayName === "Kiru.lazy"
  )
}

function isContextProvider(thing: unknown): thing is Kiru.KiruNode {
  return isKiruNode(thing) && thing.type === $CONTEXT
}

function getCurrentOwner(): Kiru.KiruNode | null {
  return node.current as Kiru.KiruNode | null
}

function getOwnerApp(
  node: Kiru.KiruNode
): import("../appHandle.js").AppHandle | null {
  let current: Kiru.KiruNode | null = node
  while (current) {
    if (current.app) {
      node.app = current.app
      return current.app
    }
    current = current.parent
  }
  return null
}

function findParent(
  node: Kiru.KiruNode,
  predicate: (node: Kiru.KiruNode) => boolean
): Kiru.KiruNode | null {
  let current = node.parent
  while (current) {
    if (predicate(current)) return current
    current = current.parent
  }
  return null
}

function assertValidElementProps(node: Kiru.KiruNode): void {
  if ("children" in node.props && node.props.innerHTML) {
    throw new KiruError({
      message: "Cannot use both children and innerHTML on an element",
      node,
    })
  }

  for (const key in node.props) {
    if ("bind:" + key in node.props) {
      throw new KiruError({
        message: `Cannot use both bind:${key} and ${key} on an element`,
        node,
      })
    }
  }
}

function normalizeElementKey(thing: unknown): JSX.ElementKey | null {
  if (thing === undefined) return null
  if (typeof thing === "string" || typeof thing === "number") return thing
  return null
}

function createStableId(node: Kiru.KiruNode): string {
  const path: number[] = []
  let current: Kiru.KiruNode | null = node
  while (current) {
    path.push(current.index)
    current = current.parent
  }
  return `k:${BigInt(path.join("")).toString(36)}`
}

function registerCleanup(
  node: Kiru.KiruNode,
  id: string,
  callback: () => void
): void {
  ;(node.cleanups ??= {})[id] = callback
}

function propsChanged(
  oldProps: Kiru.KiruNode["props"],
  newProps: Kiru.KiruNode["props"],
  keysToSkip?: string[]
): boolean {
  const aKeys = Object.keys(oldProps)
  const bKeys = Object.keys(newProps)
  if (aKeys.length !== bKeys.length) return true
  for (const key of aKeys) {
    if (keysToSkip?.includes(key)) continue
    if (oldProps[key] !== newProps[key]) return true
  }
  return false
}

function getNodeFromDom(domNode: Node | null): Kiru.KiruNode | null {
  if (!domNode) return null
  const meta = domNode.__kiru
  if (!meta) return null
  return meta.component ?? meta
}

function getAppOwners(app: AppHandle): Kiru.KiruNode[] {
  const owners = new Set<Kiru.KiruNode>()
  const rootRange = app.root.range
  if (!rootRange) return []
  let current: Node | null = rootRange.start
  while (current) {
    const owner = getNodeFromDom(current)
    if (owner) owners.add(owner)
    if (current === rootRange.end) break
    current = current.nextSibling
  }
  return Array.from(owners)
}

function getOwnerElements(owner: Kiru.KiruNode): Set<Element> {
  const elements = new Set<Element>()
  if (owner.rootNode instanceof Element) {
    elements.add(owner.rootNode)
  }
  const range = owner.range
  if (!range) return elements

  let current: Node | null = range.start.nextSibling
  while (current && current !== range.end) {
    if (current instanceof Element) elements.add(current)
    // if (
    //   current.nodeType === Node.COMMENT_NODE &&
    //   current === (current as Comment).__kiru?.range?.start
    // ) {
    //   const rangeEnd = (current as Comment).__kiru?.range?.end
    //   current = rangeEnd ?? current
    // }
    current = current.nextSibling
  }
  return elements
}
