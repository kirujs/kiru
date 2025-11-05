import { useSignal } from "kiru"
import { Head } from "kiru/router"

export default function HomePage() {
  const count = useSignal(0)
  return (
    <div>
      <Head.Content>
        <title>My App - Home ({count})</title>
        test
      </Head.Content>
      <button onclick={() => count.value++}>Increment</button>
      <span>Count: {count}</span>
      <p>This page is wrapped by the root layout only.</p>
      <p>You can see the navigation header and footer from the root layout.</p>
    </div>
  )
}
