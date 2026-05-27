import { signal } from "kiru"
import { AnotherCounter, Counter } from "./counter"

export function App() {
  const toggled = signal(false)
  return () => (
    <div>
      <h1>Static content</h1>
      <button onclick={() => toggled.set((t) => !t)}>Toggle</button>
      {toggled() && <Counter />}
      <AnotherCounter />
    </div>
  )
}
