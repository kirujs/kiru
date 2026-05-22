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

export const getServerEcho = action.post({
  validation: { body: mySchema },
  handler: async ({ body }) => {
    return `Echo ${body.name}`
  },
})

const demoUsers = new Map<string, { id: string; name: string }>([
  ["1", { id: "1", name: "Demo User" }],
])

export const users = {
  get: action.get(async ({ context }) => {
    const id = (context as { userId?: string }).userId ?? "1"
    return demoUsers.get(id) ?? null
  }),
  rename: action.patch(
    async ({ body }: RemoteActionHandlerArgs<{ id: string; name: string }>) => {
      const u = demoUsers.get(body.id)
      if (!u) throw new Error("User not found")
      u.name = body.name
      return u
    }
  ),
}

export const renameUserViaNamespace = action.post(
  async ({ body }: RemoteActionHandlerArgs<{ id: string; name: string }>) => {
    const before = await users.get()
    const updated = await users.rename({ body })
    return { before, updated }
  }
)
