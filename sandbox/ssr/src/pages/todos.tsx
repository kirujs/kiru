import { Derive, onMount, resource, signal } from "kiru"
import { createFormController } from "kiru/remote"
import { Link, useRequestContext } from "kiru/router"
import { ActionDispatchError } from "kiru/remote"
import {
  addTodo,
  deleteTodo,
  listTodos,
  toggleTodo,
  updateTodo,
  type TodoItem,
} from "./todos.actions.js"
import { logoutForm } from "./login.actions.js"

export default function TodosPage() {
  const ctx = useRequestContext()
  const todos = resource(async () => {
    try {
      return await listTodos()
    } catch (e) {
      if (e instanceof ActionDispatchError) throw new Error(e.message)
      throw e
    }
  })
  const addForm = createFormController(addTodo)
  const logout = createFormController(logoutForm)
  const editingId = signal<string | null>(null)
  const editText = signal("")

  onMount(() => {
    return addForm.result.subscribe((result) => {
      if (!result || !("todo" in result) || !result.todo) return
      todos.refetch()
      addForm.result.set(null)
    })
  })

  async function onToggle(id: string) {
    try {
      await toggleTodo({ body: { id } })
      todos.refetch()
    } catch {
      /* ignore */
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteTodo({ body: { id } })
      todos.refetch()
    } catch {
      /* ignore */
    }
  }

  function startEdit(todo: TodoItem) {
    editingId.set(todo.id)
    editText.set(todo.text)
  }

  function cancelEdit() {
    editingId.set(null)
    editText.set("")
  }

  async function saveEdit(id: string) {
    const text = editText().trim()
    if (!text) return
    try {
      await updateTodo({ body: { id, text } })
    } catch {
      return
    }
    editingId.set(null)
    editText.set("")
    todos.refetch()
  }

  return () => {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Todos</h2>
            <p className="text-sm text-slate-400">
              Signed in as{" "}
              <span className="font-mono text-cyan-200">
                {ctx.user?.name ?? "unknown"}
              </span>
              {ctx.user?.email ? (
                <span className="text-slate-500"> ({ctx.user.email})</span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/account"
              className="rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:border-cyan-500 hover:text-cyan-200"
            >
              Account
            </Link>
            <form
              action={logout.action}
              method={logout.method}
              onsubmit={logout.onsubmit}
            >
              <button
                type="submit"
                className="rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:border-rose-500 hover:text-rose-200"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <Derive
          from={todos}
          fallback={<p className="text-slate-400">Loading todos…</p>}
        >
          {(items) => (
            <ul className="space-y-2">
              {items.length === 0 ? (
                <li className="text-sm text-slate-500">No todos yet.</li>
              ) : (
                items.map((todo) => (
                  <li
                    key={todo.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onchange={() => onToggle(todo.id)}
                      aria-label={`Toggle ${todo.text}`}
                    />
                    {editingId() === todo.id ? (
                      <>
                        <input
                          className="min-w-[10rem] flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                          type="text"
                          bind:value={editText}
                        />
                        <button
                          type="button"
                          className="text-xs text-cyan-300 hover:text-cyan-100"
                          onclick={() => saveEdit(todo.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-slate-200"
                          onclick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className={
                            todo.completed
                              ? "min-w-0 flex-1 text-slate-500 line-through"
                              : "min-w-0 flex-1 text-slate-200"
                          }
                        >
                          {todo.text}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-cyan-300 hover:text-cyan-100"
                          onclick={() => startEdit(todo)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs text-rose-300 hover:text-rose-200"
                          onclick={() => onDelete(todo.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}
        </Derive>

        <form
          className="flex flex-wrap gap-2 rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-4"
          action={addForm.action}
          method={addForm.method}
          onsubmit={addForm.onsubmit}
        >
          <input
            className="min-w-[12rem] flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            name="text"
            type="text"
            placeholder="New todo"
            autocomplete="off"
          />
          <button
            type="submit"
            className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
            disabled={addForm.isPending}
          >
            {() => (addForm.isPending() ? "Adding…" : "Add todo")}
          </button>
        </form>
        <p className="text-xs text-rose-300">
          {() => {
            const res = addForm.result()
            return res?.ok === false ? res.error.message : addForm.error() ?? ""
          }}
        </p>

        <p className="text-sm">
          <Link to="/" className="text-cyan-300 hover:underline">
            ← Home
          </Link>
        </p>
      </div>
    )
  }
}
