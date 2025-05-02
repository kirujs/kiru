import { useTodosStore } from "./store"

export default function StoreExample() {
  const { value: todoIds } = useTodosStore(
    (store) => store.map((item) => item.id),
    (prev, next) => prev.length === next.length
  )
  console.log("parent component")

  return (
    <ul>
      {todoIds.map((id) => (
        <TodoItem id={id} />
      ))}
    </ul>
  )
}

function TodoItem({ id }: { id: string }) {
  const { value: todo, toggleTodo } = useTodosStore(
    (store) => store.find((item) => item.id === id)!
  )

  console.log("child component", todo.id)

  return (
    <div>
      {todo.text}
      <input
        type="checkbox"
        checked={todo.done}
        onchange={() => toggleTodo(todo.id)}
      />
    </div>
  )
}
