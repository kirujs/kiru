"use dom"

import { mount, signal, type DomAppHandle } from "kiru/dom"
import { Counter } from "./counter.tsx"

export function mountToggle(container: HTMLElement): DomAppHandle {
  return mount(() => <ToggleApp />, container)
}

function ToggleApp() {
  const visible = signal(false)

  return () => (
    <div data-testid="toggle-app">
      <button
        type="button"
        data-testid="toggle-btn"
        onclick={() => visible.set((v) => !v)}
      >
        Toggle
      </button>
      {visible() && <Counter testId="child-counter" />}
    </div>
  )
}
