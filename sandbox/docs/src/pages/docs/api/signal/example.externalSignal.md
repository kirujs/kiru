```jsx
// signals.js
const input = signal("")
const todos = signal([])

// Todos.jsx
import { input, todos } from "signals.ts"
const Page = () => {
  const handleSubmit = (e) = > {
    e.preventDefault()
    todos.value = [...todos.value, input.value]
    input.value = ""
  }

  return (
    <form onsubmit={handleSubmit}>
      <input type="text" oninput={(e) => (input.value = e.target.value)} />
      <ul>
        {todos.value.map((item) => <li>{item}</li>)}
      </ul>
    </form>
  )
}
```
