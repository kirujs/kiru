/*
 * ── Source (author JSX) ─────────────────────────────────────
 *
 * function ToggleApp() {
 *   const visible = signal(false)
 *   return () => (
 *     <div data-testid="toggle-app">
 *       <button type="button" data-testid="toggle-btn" onclick={() => visible.set(v => !v)}>Toggle</button>
 *       {visible() && <Counter testId="child-counter" />}
 *     </div>
 *   )
 * }
 *
 * ── Compiler output (emitted) ───────────────────────────────
 */

import {
  domShow,
  mount,
  on,
  signal,
  template,
  clone,
  project,
  type DomAppHandle,
} from "kiru/dom"
import { createCounter } from "./counter.ts"

const $t0 = template(`<div data-testid="toggle-app">
  <button type="button" data-testid="toggle-btn">Toggle</button>
  <!--#-->
</div>`, 1)

export function mountToggle(container: HTMLElement): DomAppHandle {
  const visible = signal(false)

  return mount(() => {
    const $el0 = clone($t0)
    const $n0 = project($t0, $el0)
    // nodes[0]=toggle btn, anchors[0]=counter hole
    const toggleBtn = $n0.nodes[0]!

    on(toggleBtn, "click", () => visible.set((v) => !v))

    domShow(visible, $n0.anchors[0]!, () => createCounter({ testId: "child-counter" }))

    return $el0
  }, container)
}
