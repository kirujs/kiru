import { signal, setup } from "kiru"

const initialCount = signal(0)

export function App() {
  console.log(initialCount())
  return (
    <div>
      <input bind:value={initialCount} type="number" />
      {initialCount()}
      <Counter
        foo={{ initialCount: initialCount() }}
        items={[initialCount(), 2, 3]}
      />
    </div>
  )
}

interface CounterProps {
  foo: {
    initialCount: number
  }
  items: number[]
}

const StaticBadge = () => <span className="badge">OK</span>

const Counter: Kiru.Component<CounterProps> = () => {
  const { derive } = setup<typeof Counter>()
  const count = derive((props) => props.foo.initialCount)

  return (props) => (
    <div>
      <p>Items: {JSON.stringify(props.items)}</p>
      <h1>Count: {count}</h1>
      <button onclick={() => count.set((c) => c + 1)}>Increment</button>
    </div>
  )
}
