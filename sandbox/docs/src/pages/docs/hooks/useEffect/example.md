```jsx
import { useState, useEffect } from "kiru"

function App() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // This effect will run once when the component is mounted, and whenever 'count' changes
    console.log("Count has changed:", count)
  }, [count])

  return (
    <div>
      <p>Count: {count}</p>
      <button onclick={() => setCount((prev) => prev + 1)}>Increment</button>
    </div>
  )
}
```
