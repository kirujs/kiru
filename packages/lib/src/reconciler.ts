import { reconcileChildren as reconcileRangeChildren } from "./dom/reconcile.js"
import { createRange } from "./dom/range.js"

/**
 * DOM-first reconciliation entrypoint.
 * This keeps the old module path while moving the implementation to range-based DOM diffing.
 */
export function reconcileChildren(
  parent: Kiru.KiruNode,
  children: unknown
): Kiru.KiruNode | null {
  const owner = parent
  const range = owner.range ?? createRange(owner)
  const nextChildren = Array.isArray(children) ? children : [children]
  reconcileRangeChildren(range, nextChildren)
  return parent
}
