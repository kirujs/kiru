```tsx
// signals.ts
const input = signal("")
const todos = signal<string[]>([])

// Todos.tsx
import { input, todos } from "signals.ts"
const Page = () => {
  const handleSubmit = (e: Event) = > {
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
