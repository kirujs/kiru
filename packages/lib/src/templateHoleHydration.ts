import { withHydrationInTemplateHole } from "./hydration.js"

type VNode = Kiru.VNode

export function findPendingTemplateHoleHost(vNode: VNode): VNode | null {
  let parent = vNode.parent
  while (parent) {
    if (parent.templateHoleAnchor && parent.templateHoleHydrationPending) {
      if (parent.dom instanceof Element) {
        return parent
      }
      return null
    }
    parent = parent.parent
  }
  return null
}

function isTopLevelHoleHydrationCandidate(
  vNode: VNode,
  host: VNode
): boolean {
  let node = vNode.parent
  while (node && node !== host) {
    if (typeof node.type === "string") return false
    node = node.parent
  }
  return node === host
}

export function withPendingTemplateHoleHydration<T>(
  vNode: VNode,
  fn: () => T
): T {
  const pendingHoleHost = findPendingTemplateHoleHost(vNode)
  if (!pendingHoleHost) return fn()
  if (!isTopLevelHoleHydrationCandidate(vNode, pendingHoleHost)) return fn()
  const span = pendingHoleHost.templateHoleHydrationSpan ?? 1
  const offset = pendingHoleHost.templateHoleHydrationOffset ?? 0
  let consumed = 0
  const out = withHydrationInTemplateHole(
    pendingHoleHost.dom as Element,
    pendingHoleHost.templateHoleAnchor!,
    span,
    offset,
    fn,
    (count) => {
      consumed = count
    }
  )
  const step = Math.max(1, consumed)
  const nextOffset = Math.min(span, offset + step)
  pendingHoleHost.templateHoleHydrationOffset = nextOffset
  if (nextOffset >= span) {
    pendingHoleHost.templateHoleHydrationPending = false
    pendingHoleHost.templateHoleHydrationSpan = undefined
    pendingHoleHost.templateHoleHydrationOffset = undefined
  } else {
    pendingHoleHost.templateHoleHydrationPending = true
    pendingHoleHost.templateHoleHydrationSpan = span
  }
  return out
}
