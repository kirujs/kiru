```tsx
function App() {
  const inputText = useSignal(""),
    todos = useSignal([])

  const handleSubmit = (e) => {
    e.preventDefault()
    const id = crypto.randomUUID(),
      text = inputText.peek(),
      todo = { id, text }

    todos.value = [...todos.value, todo]
    inputText.value = ""
  }

  console.log("Hello from Kiru! This component never rerenders 😉")

  return (
    <>
      <form onsubmit={handleSubmit}>
        <input bind:value={inputText} />
        <button type="submit">Add</button>
      </form>
      <ul>
        <For each={todos} fallback={<i>No todos</i>}>
          {(item) => <TodoItem todo={item} />}
        </For>
      </ul>
    </>
  )
}
```
