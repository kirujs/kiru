import { signal } from "kiru"

export const Counter = () => {
  const count = signal(0)
  return () => (
    <div>
      <h1>Count: {count}</h1>
      <button onclick={() => count.set((c) => c + 1)}>Increment</button>
    </div>
  )
}
