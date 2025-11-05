```jsx
import { useSyncExternalStore } from "kiru"
import { counterStore } from "./counterStore"

function App() {
  // Using useSyncExternalStore to subscribe to the counter store
  const count = useSyncExternalStore(
    counterStore.subscribe, // Subscribe function
    counterStore.getState // Get current state function
  )

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onclick={counterStore.increment}>Increment</button>
    </div>
  )
}
```
