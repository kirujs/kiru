import { action, RemoteError, type Schema } from "kiru/remote"
import type { SandboxUser } from "../server/auth.js"

export interface TodoItem {
  id: string
  text: string
  completed: boolean
}

const todosByUser = new Map<string, TodoItem[]>()

function todosFor(userId: string): TodoItem[] {
  let list = todosByUser.get(userId)
  if (!list) {
    list = [
      { id: crypto.randomUUID(), text: "Try the form action below", completed: false },
      { id: crypto.randomUUID(), text: "Toggle me via JSON action", completed: false },
    ]
    todosByUser.set(userId, list)
  }
  return list
}

function requireUser(user: SandboxUser | null | undefined): SandboxUser {
  if (!user) {
    throw new RemoteError("Sign in required", "UNAUTHORIZED", { status: 401 })
  }
  return user
}

/** JSON GET — list todos for the signed-in user. */
export const listTodos = action(async ({ context }) => {
  const user = requireUser(context.user)
  return todosFor(user.id)
})

const addTodoSchema: Schema<{ text: string }> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null || !("text" in input)) {
      throw new Error("Invalid")
    }
    const text = (input as { text: unknown }).text
    if (typeof text !== "string" || !text.trim()) throw new Error("Invalid")
    return { text: text.trim() }
  },
}

/** Form POST — add a todo (progressive enhancement via createFormController). */
export const addTodo = action({
  type: "form",
  validation: { body: addTodoSchema },
  handler: async ({ body, context }) => {
    const user = context.user
    if (!user) {
      return {
        ok: false as const,
        error: { message: "Sign in required", code: "UNAUTHORIZED" },
      }
    }
    const todo: TodoItem = {
      id: crypto.randomUUID(),
      text: body.text,
      completed: false,
    }
    todosFor(user.id).push(todo)
    return { todo }
  },
})

const toggleSchema: Schema<{ id: string }> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null || !("id" in input)) {
      throw new Error("Invalid")
    }
    const id = (input as { id: unknown }).id
    if (typeof id !== "string" || !id) throw new Error("Invalid")
    return { id }
  },
}

/** JSON POST — toggle completed (remote fetch, not a native form). */
export const toggleTodo = action({
  validation: { body: toggleSchema },
  handler: async ({ body, context }) => {
    const user = requireUser(context.user)
    const todo = todosFor(user.id).find((t) => t.id === body.id)
    if (!todo) {
      throw new RemoteError("Todo not found", "NOT_FOUND", { status: 404 })
    }
    todo.completed = !todo.completed
    return todo
  },
})

const deleteSchema: Schema<{ id: string }> = {
  parse: (input) => toggleSchema.parse(input),
}

/** JSON POST — delete a todo. */
export const deleteTodo = action({
  validation: { body: deleteSchema },
  handler: async ({ body, context }) => {
    const user = requireUser(context.user)
    const list = todosFor(user.id)
    const idx = list.findIndex((t) => t.id === body.id)
    if (idx < 0) {
      throw new RemoteError("Todo not found", "NOT_FOUND", { status: 404 })
    }
    list.splice(idx, 1)
    return { ok: true as const }
  },
})

const updateSchema: Schema<{ id: string; text: string }> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null) throw new Error("Invalid")
    const id = (input as { id?: unknown }).id
    const text = (input as { text?: unknown }).text
    if (typeof id !== "string" || !id) throw new Error("Invalid id")
    if (typeof text !== "string" || !text.trim()) throw new Error("Invalid text")
    return { id, text: text.trim() }
  },
}

/** JSON POST — update todo text. */
export const updateTodo = action({
  validation: { body: updateSchema },
  handler: async ({ body, context }) => {
    const user = requireUser(context.user)
    const todo = todosFor(user.id).find((t) => t.id === body.id)
    if (!todo) {
      throw new RemoteError("Todo not found", "NOT_FOUND", { status: 404 })
    }
    todo.text = body.text
    return todo
  },
})
