import { action, Schema } from "kiru/remote"
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

export const getSandboxServerEcho = action.get(async (ctx) => {
  const name = ctx.user?.name ?? "guest"
  return `Remote OK: ${name} ${test}`
})

export const getServerEcho = action.post(mySchema, async (_ctx, input) => {
  return `Echo ${input.name}`
})

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

export const createTodo = action.post(createTodoSchema, (_ctx, input) => {
  const todo: TodoItem = {
    id: crypto.randomUUID(),
    text: input.text,
    completed: false,
  }
  return (todos.push(todo), todo)
})

export const updateTodo = action.post(updateTodoSchema, async (_ctx, input) => {
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
})
