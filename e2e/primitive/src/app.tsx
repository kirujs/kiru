/**
 * Mirrors sandbox/primitive/src/app.tsx — holed shell with bind:input + Counter component.
 */
import { signal, setup } from "kiru"

const initialCount = signal(0)

interface CounterProps {
  foo: { initialCount: number }
  items: number[]
}

const Counter: Kiru.Component<CounterProps> = () => {
  const { derive } = setup<typeof Counter>()
  const count = derive((props) => props.foo.initialCount)

  return (props) => (
    <div data-testid="counter">
      <p data-testid="counter-items">Items: {JSON.stringify(props.items)}</p>
      <h1 data-testid="counter-value">Count: {count}</h1>
      <button
        type="button"
        data-testid="counter-increment"
        onclick={() => count.set((c) => c + 1)}
      >
        Increment
      </button>
    </div>
  )
}

export function App() {
  return (
    <div data-testid="app-root">
      <input
        data-testid="initial-count"
        bind:value={initialCount}
        type="number"
      />
      <Counter
        foo={{ initialCount: initialCount() }}
        items={[initialCount(), 2, 3]}
      />
    </div>
  )
}
