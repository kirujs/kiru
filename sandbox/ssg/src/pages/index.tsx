import { signal } from "kiru"
import { Head } from "kiru/router"

const count = signal(0)
const increment = () => count.value++
const decrement = () => count.value--

export default function HomePage() {
  return (
    <div>
      <Head.Content>
        <title>My App - Home ({count.value})</title>
      </Head.Content>
      <button onclick={increment}>Increment</button>
      <span>Count: {count.value}</span>
      <p>This page is wrapped by the root layout only.</p>
      <p>You can see the navigation header and footer from the root layout.</p>
    </div>
  )
}
