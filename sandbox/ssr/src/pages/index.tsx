import { Derive, ErrorBoundary, resource } from "kiru"
import { getTodos, createTodo, updateTodo } from "../index.actions"

export default function HomePage() {
  const todosData = resource(({ signal }) => getTodos(void 0, { signal }))

  return () => (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">Todos</h2>
      <ErrorBoundary onError={console.log}>
        <Derive from={todosData} fallback={<p>Loading...</p>}>
          {(todos, isStale) => {
            console.log("render list", todos)
            return (
              <ul className="space-y-2" style={{ opacity: isStale ? 0.5 : 1 }}>
                {todos.map((todo) => (
                  <li key={todo.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      data-test={true}
                      checked={todo.completed}
                      onchange={(e) =>
                        updateTodo({
                          id: todo.id,
                          completed: e.currentTarget.checked,
                        })
                          .then((todo) => {
                            console.log("updated todo", todo)
                            todosData.refetch()
                            // todosData.value = todosData.value.map((t) =>
                            //   t.id === todo.id ? todo : t
                            // )
                          })
                          .catch((e) => {
                            console.error(e)
                            todosData.refetch()
                          })
                      }
                    />
                    <input
                      type="text"
                      value={todo.text}
                      oninput={(e) =>
                        updateTodo({
                          id: todo.id,
                          text: e.currentTarget.value,
                        }).then((todo) => {
                          todosData.value = todosData.value.map((t) =>
                            t.id === todo.id ? todo : t
                          )
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )
          }}
        </Derive>
      </ErrorBoundary>

      <form
        onsubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget)
          createTodo({ text: formData.get("text") as string }).then(
            () => todosData.refetch()
            //(todo) => (todosData.value = [...todosData.value, todo])
          )
          e.currentTarget.reset()
        }}
      >
        <input name="text" type="text" placeholder="Add todo" />
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
