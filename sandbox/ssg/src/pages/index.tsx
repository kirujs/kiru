import { useState } from "kiru"

export default function HomePage() {
  const [count, setCount] = useState(2)
  return (
    <div>
      <button onclick={() => setCount(count + 1)}>Increment</button>
      <span>Count: {count}</span>
      <p>This page is wrapped by the root layout only.</p>
      <p>You can see the navigation header and footer from the root layout.</p>
    </div>
  )
}
