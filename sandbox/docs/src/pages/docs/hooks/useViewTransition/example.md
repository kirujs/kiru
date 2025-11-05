```jsx
import { useState, useViewTransition } from "kiru"

function App() {
  const [count, setCount] = useState(0)
  const transition = useViewTransition()

  const handleClick = () => {
    transition(() => setCount(count + 1))
  }

  return (
    <div>
      <p style={`font-size: ${16 + count}px; view-transition-name: count`}>
        Count: {count}
      </p>
      <button onclick={handleClick}>Increment</button>
    </div>
  )
}
```
