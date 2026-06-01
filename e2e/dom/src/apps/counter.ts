/*
 * ── Source (author JSX) ─────────────────────────────────────
 *
 * function Counter({ initial = 0, testId = "counter" }: CounterProps) {
 *   const count = signal(initial)
 *   return () => (
 *     <div class="counter-item" data-testid={testId}>
 *       <span class="counter-value">{count}</span>
 *       <button class="increment" type="button" data-testid="increment" onclick={() => count.set(c => c + 1)}>+</button>
 *       <button class="decrement" type="button" data-testid="decrement" onclick={() => count.set(c => c - 1)}>-</button>
 *     </div>
 *   )
 * }
 *
 * ── Compiler output (emitted) ───────────────────────────────
 */

import {
  clone,
  createComponent,
  domEffect,
  mount,
  on,
  project,
  signal,
  template,
  type ComponentHandle,
  type DomAppHandle,
} from "kiru/dom"

export const COUNTER_HTML = `<div class="counter-item" data-testid="counter">
  <span class="counter-value">0</span>
  <button class="increment" type="button" data-testid="increment">+</button>
  <button class="decrement" type="button" data-testid="decrement">-</button>
</div>`

const $t0 = template(COUNTER_HTML)

export type CounterProps = {
  initial?: number
  testId?: string
}

export function createCounter(props: CounterProps = {}): ComponentHandle {
  const { initial = 0, testId = "counter" } = props

  return createComponent((_props: CounterProps) => {
    const count = signal(initial)
    const $el0 = clone($t0)
    if (testId) {
      $el0.setAttribute("data-testid", testId)
    }
    const $n0 = project($t0, $el0)
    // nodes[0]=value span, [1]=increment, [2]=decrement
    const valueEl = $n0.nodes[0]!
    const increment = $n0.nodes[1]!
    const decrement = $n0.nodes[2]!

    domEffect(() => {
      valueEl.textContent = String(count())
    })

    on(increment, "click", () => count.set((c) => c + 1))
    on(decrement, "click", () => count.set((c) => c - 1))

    return $el0
  }, props)
}

export function mountCounter(container: HTMLElement): DomAppHandle {
  return mount(() => createCounter().getRoot(), container)
}
