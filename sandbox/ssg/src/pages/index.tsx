import { createStore } from "kiru"
import { Head } from "kiru/router"

const useCountStore = createStore(0, (set) => ({
  increment: () => set((state: number) => state + 1),
  decrement: () => set((state: number) => state - 1),
}))

export default function HomePage() {
  const count = useCountStore()
  return (
    <div>
      <Head.Content>
        <title>My App - Home ({count.value})</title>
      </Head.Content>
      <button onclick={count.increment}>Increment</button>
      <span>Count: {count.value}</span>
      <p>This page is wrapped by the root layout only.</p>
      <p>You can see the navigation header and footer from the root layout.</p>
    </div>
  )
}
