import { signal, setup } from "kiru"

const initialCount = signal(0)
export function App() {
  console.log(initialCount.value)
  return (
    <div>
      <input bind:value={initialCount} type="number" />
      <Counter
        foo={{ initialCount: initialCount.value }}
        items={[initialCount.value, 2, 3]}
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

const Counter: Kiru.FC<CounterProps> = () => {
  const { derive, props } = setup<typeof Counter>()
  const count = derive((props) => props.foo.initialCount)

  return () => (
    <div>
      <p>Items: {JSON.stringify(props.items)}</p>
      <h1>Count: {count}</h1>
      <button onclick={() => count.value++}>Increment</button>
    </div>
  )
}
