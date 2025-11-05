```jsx
import { useEffect, useEffectEvent, useState } from "kiru"

function App() {
  const [count, setCount] = useState(0)

  const onTick = useEffectEvent(() => {
    console.log("count", count) // always logs the current count!
  })

  useEffect(() => {
    const interval = setInterval(() => {
      console.log(count) // always logs 0 due to encapsulation
      onTick()
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex flex-col gap-2 px-10 py-20">
      <button onclick={() => setCount((prev) => prev + 1)}>Increment</button>
      <span className="text-4xl font-medium select-none">{count}</span>
    </div>
  )
}
```
