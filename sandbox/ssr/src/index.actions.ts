import { action, RemoteActionHandlerArgs, Schema } from "kiru/remote"
import { test } from "./test"

console.log(test)

const mySchema: Schema<{ name: string }> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null || !("name" in input)) {
      throw new Error("Invalid input")
    }
    return input as { name: string }
  },
}

export const getSandboxServerEcho = action.get(async ({ context }) => {
  const name = context.user?.name ?? "guest"
  return `Remote OK: ${name} ${test}`
})

export const getServerEcho = action.post(
  { schema: mySchema },
  async ({ input }) => {
    return `Echo ${input.name}`
  }
)

export interface TodoItem {
  id: string
  text: string
  completed: boolean
}

export type CreateTodoInput = Omit<TodoItem, "id" | "completed">
export type UpdateTodoInput = Partial<Omit<TodoItem, "id">> & {
  id: string
}

const createTodoSchema: Schema<CreateTodoInput> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null || !("text" in input)) {
      throw new Error("Invalid input")
    }
    return input as CreateTodoInput
  },
}

const updateTodoSchema: Schema<UpdateTodoInput> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null || !("id" in input)) {
      throw new Error("Invalid input")
    }
    return input as UpdateTodoInput
  },
}

const todos: TodoItem[] = [
  {
    id: "1",
    text: "buy coffee",
    completed: false,
  },
]

export const getTodos = action.get(async () => {
  await new Promise((r) => setTimeout(r, 4000))
  return todos
})

export const createTodo = action.post(
  { schema: createTodoSchema },
  ({ input }) => {
    const todo: TodoItem = {
      id: crypto.randomUUID(),
      text: input.text,
      completed: false,
    }
    return todos.push(todo), todo
  }
)

const demoUsers = new Map<string, { id: string; name: string }>([
  ["1", { id: "1", name: "Demo User" }],
])

export const users = {
  get: action.get(async ({ context }) => {
    const id = (context as { userId?: string }).userId ?? "1"
    return demoUsers.get(id) ?? null
  }),
  rename: action.patch(
    async ({
      input,
    }: RemoteActionHandlerArgs<{ id: string; name: string }>) => {
      const u = demoUsers.get(input.id)
      if (!u) throw new Error("User not found")
      u.name = input.name
      return u
    }
  ),
}

export const renameUserViaNamespace = action.post(
  async ({ input }: RemoteActionHandlerArgs<{ id: string; name: string }>) => {
    const before = await users.get()
    const updated = await users.rename({ input })
    return { before, updated }
  }
)

export const updateTodo = action.post(
  { schema: updateTodoSchema },
  async ({ input }) => {
    //if (Math.random() > 0.5) throw new Error("Random error")
    const todo = todos.find((t) => t.id === input.id)
    if (!todo) throw new Error("Todo not found")
    if ("text" in input && typeof input.text === "string") {
      todo.text = input.text
    }
    if ("completed" in input && typeof input.completed === "boolean") {
      todo.completed = input.completed
    }
    return todo
  }
)
