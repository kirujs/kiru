import type { MaybeDom, SomeDom } from "./types.utils.js"

const parents: SomeDom[] = []
const childIdx: number[] = []

function isHydrationSkippableNode(node: ChildNode | undefined): boolean {
  if (!node) return true
  if (node.nodeType === Node.COMMENT_NODE) return true // comment
  if (node.nodeType === Node.CDATA_SECTION_NODE) return true // CDATA
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node as Text).textContent ?? ""
    return !/\S/.test(t)
  }
  return false
}

export const hydrationStack = {
  bumpChildIndex() {
    const parent = this.getCurrentParent()
    let idx = childIdx[childIdx.length - 1]
    while (
      idx < parent.childNodes.length &&
      isHydrationSkippableNode(parent.childNodes[idx])
    ) {
      idx++
    }
    if (idx < parent.childNodes.length) idx++
    childIdx[childIdx.length - 1] = idx
  },
  getCurrentChild(): MaybeDom {
    const parent = this.getCurrentParent()
    let idx = childIdx[childIdx.length - 1]
    while (
      idx < parent.childNodes.length &&
      isHydrationSkippableNode(parent.childNodes[idx])
    ) {
      idx++
    }
    const node = parent.childNodes[idx]
    if (!node || isHydrationSkippableNode(node)) return undefined
    return node as SomeDom
  },
  getCurrentParent() {
    return parents[parents.length - 1]
  },
  clear() {
    parents.length = 0
    childIdx.length = 0
  },
  pop() {
    parents.pop()
    childIdx.pop()
  },
  push(el: SomeDom) {
    parents.push(el)
    childIdx.push(0)
  },
}
