"use dom"

import { signal, mount, type DomAppHandle } from "kiru/dom"

export interface CounterProps {
  initial?: number
  testId?: string
}

export function mountCounter(container: HTMLElement): DomAppHandle {
  return mount(() => <Counter />, container)
}

export function Counter(props: CounterProps) {
  const count = signal(props.initial ?? 0)
  const testId = props.testId ?? "counter"

  return () => (
    <div className="counter-item" data-testid={testId}>
      <span className="counter-value">{count()}</span>
      <button
        className="increment"
        type="button"
        data-testid="increment"
        onclick={() => count.set((c) => c + 1)}
      >
        +
      </button>
      <button
        className="decrement"
        type="button"
        data-testid="decrement"
        onclick={() => count.set((c) => c - 1)}
      >
        -
      </button>
    </div>
  )
}
