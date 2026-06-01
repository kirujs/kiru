"use dom"

import { mount, signal, type DomAppHandle } from "kiru/dom"
import { Counter } from "./counter.tsx"

export function mountNested(container: HTMLElement): DomAppHandle {
  return mount(() => <NestedApp />, container)
}

function NestedApp() {
  const parentCount = signal(0)

  return () => (
    <div data-testid="nested-app">
      <p className="parent-label">
        Parent:{" "}
        <span
          data-testid="parent-value"
          onclick={() => parentCount.set((c) => c + 1)}
        >
          {parentCount()}
        </span>
      </p>
      <Counter initial={5} testId="child-counter" />
    </div>
  )
}
