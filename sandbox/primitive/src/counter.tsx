import { signal } from "kiru"

const count = signal(0)
export const Counter = () => {
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onclick={() => count.set((c) => c + 1)}>Increment</button>
      <Badge />
      <div>
        {123} asdasd
        <p>Hello world</p>
        <Toggler />
      </div>
    </div>
  )
}

export const AnotherCounter = () => {
  const count = signal(0)
  return () => (
    <div>
      <h1>Count: {count}</h1>
      <button onclick={() => count.set((c) => c + 1)}>Increment</button>
      <Badge />
    </div>
  )
}

const Badge = () => <span className="badge">OK</span>

const Toggler = () => {
  const toggled = signal(false)
  return () => (
    <div>
      <button onclick={() => toggled.set((t) => !t)}>Toggle</button>
      {toggled() && <p>Toggled</p>}
    </div>
  )
}
