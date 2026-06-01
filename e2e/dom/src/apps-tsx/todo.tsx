"use dom"

import { For, mount, signal, type DomAppHandle } from "kiru/dom"

export function mountTodo(container: HTMLElement): DomAppHandle {
  return mount(() => <TodoApp />, container)
}

type TodoItem = {
  id: string
  text: string
  done: boolean
}

let nextId = 1

function TodoApp() {
  const items = signal<TodoItem[]>([])
  const draft = signal("")

  function addTodo(e: Kiru.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = draft().trim()
    if (!text) return
    items.set([...items(), { id: String(nextId++), text, done: false }])
    draft.set("")
  }

  return () => (
    <div data-testid="todo-app">
      <form className="todo-form" onsubmit={addTodo}>
        <input
          data-testid="todo-input"
          type="text"
          placeholder="New todo"
          bind:value={draft}
        />
        <button type="submit" data-testid="todo-add">
          Add
        </button>
      </form>
      <ul className="todo-list" data-testid="todo-list">
        <For each={items} key={(item) => item.id}>
          {(item) => (
            <li className="todo-row">
              <input
                type="checkbox"
                className="todo-done"
                checked={item.done}
                onchange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked
                  items.set(
                    items().map((t) =>
                      t.id === item.id ? { ...t, done: checked } : t
                    )
                  )
                }}
              />
              <span className="todo-text">{item.text}</span>
              <button
                type="button"
                className="todo-delete"
                onclick={() =>
                  items.set(items().filter((t) => t.id !== item.id))
                }
              >
                Delete
              </button>
            </li>
          )}
        </For>
      </ul>
      <p data-testid="todo-count">{items().length} items</p>
    </div>
  )
}
