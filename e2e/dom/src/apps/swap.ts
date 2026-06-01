/*
 * ── Source (author JSX) ─────────────────────────────────────
 *
 * function SwapApp() {
 *   const useCounter = signal(true)
 *   return () => (
 *     <div data-testid="swap-app">
 *       <button type="button" data-testid="swap-btn" onclick={() => useCounter.set(v => !v)}>Swap</button>
 *       {useCounter() ? <Counter testId="child-counter" /> : <Panel />}
 *     </div>
 *   )
 * }
 *
 * ── Compiler output (emitted) ───────────────────────────────
 */

import {
  clone,
  createComponent,
  createRegion,
  domEffect,
  mount,
  on,
  project,
  signal,
  template,
  type ComponentHandle,
  type DomAppHandle,
} from "kiru/dom"
import { createCounter } from "./counter.ts"

const $t0 = template(`<div data-testid="swap-app">
  <button type="button" data-testid="swap-btn">Swap</button>
  <!--#-->
</div>`, 1)

const $t1 = template(`<div class="panel" data-testid="panel">
  <span class="panel-label">Panel</span>
  <button type="button" data-testid="panel-btn">Panel action</button>
</div>`)

function createPanel(): ComponentHandle {
  return createComponent(() => {
    const $el1 = clone($t1)
    const $n1 = project($t1, $el1)
    // nodes[0]=label span, [1]=action button
    let clicks = 0
    on($n1.nodes[1]!, "click", () => {
      clicks++
      $n1.nodes[0]!.textContent = `Panel (${clicks})`
    })
    return $el1
  }, {})
}

export function mountSwap(container: HTMLElement): DomAppHandle {
  const useCounter = signal(true)

  return mount(() => {
    const $el0 = clone($t0)
    const $n0 = project($t0, $el0)
    const swapBtn = $n0.nodes[0]!
    const outlet = createRegion($n0.anchors[0]!)

    on(swapBtn, "click", () => useCounter.set((v) => !v))

    domEffect(() => {
      if (useCounter()) {
        outlet.mount(createCounter({ testId: "child-counter" }))
      } else {
        outlet.mount(createPanel())
      }
      return () => outlet.unmount()
    })

    return $el0
  }, container)
}
