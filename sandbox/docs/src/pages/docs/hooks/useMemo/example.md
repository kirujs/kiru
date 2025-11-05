```jsx
import { useMemo, useState } from "kiru"
import { fibonacci } from "./fibonacci"

function App() {
  const [n, setN] = useState(0)
  // Memoize the result of an expensive computation
  const memoizedResult = useMemo(() => {
    // Expensive computation based on the value of 'n'
    return fibonacci(n)
  }, [n]) // Re-run when 'n' changes

  return (
    <div>
      <p>Result: {memoizedResult}</p>
      <button onclick={() => setN((prev) => prev + 1)}>Increment</button>
    </div>
  )
}
```
