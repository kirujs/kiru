```tsx
import { useReducer } from "kiru"

type CounterState = { count: number }
type CounterAction = { type: "increment" } | { type: "decrement" }

function counterReducer(state: CounterState, action: CounterAction) {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 }
    case "decrement":
      return { count: state.count - 1 }
    default:
      return state
  }
}

function Counter() {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 })

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onclick={() => dispatch({ type: "increment" })}>Increment</button>
      <button onclick={() => dispatch({ type: "decrement" })}>Decrement</button>
    </div>
  )
}
```
