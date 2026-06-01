"use dom"

import { mount, signal, type DomAppHandle } from "kiru/dom"
import { Counter } from "./counter.tsx"

export function mountSwap(container: HTMLElement): DomAppHandle {
  return mount(() => <SwapApp />, container)
}

function SwapApp() {
  const useCounter = signal(true)

  return () => (
    <div data-testid="swap-app">
      <button
        type="button"
        data-testid="swap-btn"
        onclick={() => useCounter.set((v) => !v)}
      >
        Swap
      </button>
      {useCounter() ? <Counter testId="child-counter" /> : <Panel />}
    </div>
  )
}

function Panel() {
  const clicks = signal(0)

  return () => (
    <div className="panel" data-testid="panel">
      <span className="panel-label">
        {clicks() === 0 ? "Panel" : `Panel (${clicks()})`}
      </span>
      <button
        type="button"
        data-testid="panel-btn"
        onclick={() => clicks.set((c) => c + 1)}
      >
        Panel action
      </button>
    </div>
  )
}
