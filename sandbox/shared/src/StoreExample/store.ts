import { createStore } from "kiru"

export type TodoItem = {
  id: string
  text: string
  done?: boolean
}

export const useTodosStore = createStore(
  [
    { id: "d70649dc-7b13-431a-8377-fc0ce31801ac", text: "buy coffee" },
    { id: "83d55e40-c0e7-438e-96df-fe661fd0bcec", text: "walk the dog" },
    { id: "d5c1d2d8-8f8b-4b0e-8e0c-6f6c7e8e8e8e", text: "use the whip" },
  ] as TodoItem[],
  function (set) {
    return {
      addTodo: (text: string) =>
        set((prev) => [...prev, { id: crypto.randomUUID(), text }]),

      toggleTodo: (id: string) =>
        set((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, done: !item.done } : item
          )
        ),
    }
  }
)

useTodosStore.subscribe((todos) => console.log("store changed", todos))
useTodosStore.subscribe(
  (todos) => todos.filter((todo) => todo.done).map((todo) => todo.id),
  (ids) => console.log("ids changed", ids)
)
