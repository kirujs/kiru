import { Derive, ErrorBoundary, resource, signal } from "kiru"
import { getStreamingTodos } from "./index.actions"

export default function StreamingTestPage() {
  const todosData = resource(({ signal }) =>
    getStreamingTodos(void 0, { signal })
  )
  const count = signal(0)

  return () => (
    <section className="space-y-3" data-testid="streaming-page">
      <button
        data-testid="streaming-counter"
        onclick={() => count.value++}
      >
        Count: {count}
      </button>
      <h2 className="text-xl font-semibold text-slate-100">Todos</h2>
      <ErrorBoundary onError={console.log}>
        <Derive
          from={todosData}
          fallback={<p data-testid="streaming-fallback">Loading...</p>}
        >
          {(todos) => (
            <ul data-testid="streaming-todos">
              {todos.map((todo) => (
                <li key={todo.id} data-testid="streaming-todo">
                  {todo.text}
                </li>
              ))}
            </ul>
          )}
        </Derive>
      </ErrorBoundary>
    </section>
  )
}
