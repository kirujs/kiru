import { RANGE_START } from "../constants.js"
import type { KiruNodeMeta, NodeRange } from "./metadata.js"
import { setNodeMeta } from "./metadata.js"

export function createRange(owner: Kiru.KiruNode): NodeRange {
  const start = document.createComment(RANGE_START)
  const end = document.createComment("")
  owner.range = { start, end }
  setNodeMeta(start, owner as KiruNodeMeta)
  setNodeMeta(end, owner as KiruNodeMeta)
  return owner.range
}

export function moveRange(
  range: NodeRange,
  parent: Node,
  reference: Node | null
) {
  let current: Node | null = range.start
  while (current) {
    const next: Node | null = current === range.end ? null : current.nextSibling
    parent.insertBefore(current, reference)
    if (current === range.end) break
    current = next
  }
}
