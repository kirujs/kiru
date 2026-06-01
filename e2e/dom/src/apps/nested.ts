/*
 * ── Source (author JSX) ─────────────────────────────────────
 *
 * function NestedApp() {
 *   const parentCount = signal(0)
 *   return () => (
 *     <div data-testid="nested-app">
 *       <p class="parent-label">
 *         Parent: <span data-testid="parent-value" onclick={() => parentCount.set(c => c + 1)}>{parentCount()}</span>
 *       </p>
 *       <Counter initial={5} testId="child-counter" />
 *     </div>
 *   )
 * }
 *
 * ── Compiler output (emitted) ───────────────────────────────
 */

import {
  clone,
  createRegion,
  domEffect,
  mount,
  on,
  project,
  signal,
  template,
  type DomAppHandle,
} from "kiru/dom"
import { createCounter } from "./counter.ts"

const $t0 = template(`<div data-testid="nested-app">
  <p class="parent-label">Parent: <span data-testid="parent-value">0</span></p>
  <!--#-->
</div>`, 1)

export function mountNested(container: HTMLElement): DomAppHandle {
  const parentCount = signal(0)

  return mount(() => {
    const $el0 = clone($t0)
    const $n0 = project($t0, $el0)
    // nodes[0]=p, nodes[1]=parent-value span, anchors[0]=child outlet
    const parentValue = $n0.nodes[1]!

    domEffect(() => {
      parentValue.textContent = String(parentCount())
    })

    const outlet = createRegion($n0.anchors[0]!)
    outlet.mount(createCounter({ initial: 5, testId: "child-counter" }))

    on(parentValue, "click", () => {
      parentCount.set((c) => c + 1)
    })

    return $el0
  }, container)
}
