import { For, useSignal } from "kiru"
import { CodeDemo } from "../CodeDemo"
import { DemoComponentWrapper } from "../DemoComponentWrapper"
import TodoList from "./TodoList.md"
import TodoListTS from "./TodoList.ts.md"
import styles from "./TodoList.module.css"
import { Todo } from "./types"

export function TodoListDemo() {
  const inputText = useSignal(""),
    todos = useSignal<Todo[]>([
      { id: crypto.randomUUID(), text: "Kiru" },
      { id: crypto.randomUUID(), text: "Is" },
      { id: crypto.randomUUID(), text: "Awesome!" },
    ])

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const id = crypto.randomUUID(),
      text = inputText.peek(),
      todo = { id, text }

    todos.value = [...todos.value, todo]
    inputText.value = ""
  }

  const handleRemove = (id: string) => {
    todos.value = todos.value.filter((todo) => todo.id !== id)
  }

  console.log("Hello from Kiru! This component never rerenders 😉")

  return (
    <CodeDemo name="App" mode={"jsx"} code={{ js: TodoList, ts: TodoListTS }}>
      <DemoComponentWrapper className="max-w-[340px] flex flex-col gap-4">
        <form className={styles["form"]} onsubmit={handleSubmit}>
          <input
            className={styles["form-input"]}
            bind:value={inputText}
            placeholder={"Add a todo"}
            required
          />
          <button className={styles["button"]} type="submit">
            Add
          </button>
        </form>
        <ul className={styles["todo-list"]}>
          <For each={todos} fallback={<i>No todos</i>}>
            {({ id, text }) => (
              <li className={styles["todo-item"]} key={id}>
                {text}
                <button
                  className={styles["button"]}
                  type="button"
                  onclick={() => handleRemove(id)}
                >
                  X
                </button>
              </li>
            )}
          </For>
        </ul>
      </DemoComponentWrapper>
    </CodeDemo>
  )
}
