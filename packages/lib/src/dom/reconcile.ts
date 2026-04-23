import { computeLIS } from "./lis.js"
import {
  createChild,
  isElementLike,
  unmount,
  updateChildInPlace,
} from "./runtime.js"
import type { NodeRange } from "./metadata.js"
import { getNodeMeta } from "./metadata.js"
import { RANGE_START } from "../constants.js"

function getRangeOwner(range: NodeRange): Kiru.KiruNode | null {
  return getNodeMeta(range.start)
}

function isKeyed(value: unknown): value is { key: JSX.ElementKey } {
  return isElementLike(value) && value.key !== null && value.key !== undefined
}

function collectChildren(range: NodeRange): Node[] {
  const children: Node[] = []
  let n = range.start.nextSibling
  while (n && n !== range.end) {
    children.push(n)
    if (
      n.nodeType === Node.COMMENT_NODE &&
      (n as Comment).data === RANGE_START
    ) {
      const end = getNodeMeta(n)?.range?.end
      if (end) n = end
    }
    n = n?.nextSibling ?? null
  }
  return children
}

function normalize(children: unknown[]): unknown[] {
  return children.filter(
    (c) => c !== null && c !== undefined && typeof c !== "boolean"
  )
}

function insertNodes(
  parent: Node,
  nodes: Node[],
  reference: Node | null
): void {
  for (const node of nodes) parent.insertBefore(node, reference)
}

export function reconcileChildren(range: NodeRange, children: unknown[]): void {
  const oldChildren = collectChildren(range)
  const newChildren = normalize(children)
  if (newChildren.some(isKeyed)) reconcileKeyed(range, oldChildren, newChildren)
  else reconcileSimple(range, oldChildren, newChildren)
}

function reconcileSimple(
  range: NodeRange,
  oldChildren: Node[],
  newChildren: unknown[]
) {
  const parent = range.start.parentNode!
  const owner = getRangeOwner(range)
  const minLen = Math.min(oldChildren.length, newChildren.length)
  for (let i = 0; i < minLen; i++) {
    if (!updateChildInPlace(oldChildren[i], newChildren[i])) {
      const ref = oldChildren[i + 1] ?? range.end
      unmount(oldChildren[i])
      const next = createChild(newChildren[i], i, owner)
      if (next.length) insertNodes(parent, next, ref)
    }
  }
  for (let i = minLen; i < newChildren.length; i++) {
    const next = createChild(newChildren[i], i, owner)
    if (next.length) insertNodes(parent, next, range.end)
  }
  for (let i = minLen; i < oldChildren.length; i++) unmount(oldChildren[i])
}

function reconcileKeyed(
  range: NodeRange,
  oldChildren: Node[],
  newChildren: unknown[]
) {
  const parent = range.start.parentNode!
  const owner = getRangeOwner(range)
  const keyToOld = new Map<JSX.ElementKey, number>()
  const keyToNew = new Map<JSX.ElementKey, number>()

  oldChildren.forEach((node, i) => {
    const key = getNodeMeta(node)?.key
    if (key !== null && key !== undefined) keyToOld.set(key, i)
  })
  newChildren.forEach((child, i) => {
    if (isKeyed(child)) keyToNew.set(child.key, i)
  })

  const mapping: number[] = []
  const mapOldIndex: number[] = []
  oldChildren.forEach((node, i) => {
    const key = getNodeMeta(node)?.key
    if (key !== null && key !== undefined) {
      const newIndex = keyToNew.get(key)
      if (newIndex !== undefined) {
        mapping.push(newIndex)
        mapOldIndex.push(i)
      }
    }
  })
  const lisIdx = new Set(computeLIS(mapping).map((k) => mapOldIndex[k]))
  let reference: Node | null = range.end
  for (let i = newChildren.length - 1; i >= 0; i--) {
    const child = newChildren[i]
    if (!isKeyed(child)) continue
    const oldIndex = keyToOld.get(child.key)
    if (oldIndex === undefined) {
      const created = createChild(child, i, owner)
      if (created.length) insertNodes(parent, created, reference)
      reference = created[0] ?? reference
      continue
    }
    const oldNode = oldChildren[oldIndex]
    updateChildInPlace(oldNode, child)
    if (!lisIdx.has(oldIndex)) {
      parent.insertBefore(oldNode, reference)
    }
    reference = oldNode
  }

  oldChildren.forEach((node) => {
    const key = getNodeMeta(node)?.key
    if (key !== null && key !== undefined && !keyToNew.has(key)) unmount(node)
  })
}
