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

export const getSandboxServerEcho = action(async ({ context }) => {
  const name = context.user?.name ?? "guest"
  return `Remote OK: ${name} ${test}`
})

export const getServerEcho = action({
  validation: { body: mySchema },
  handler: async ({ request }) => {
    return `Echo ${request.body.name}`
  },
})

const demoUsers = new Map<string, { id: string; name: string }>([
  ["1", { id: "1", name: "Demo User" }],
])

export const users = {
  get: action(async ({ context }) => {
    const id = (context as { userId?: string }).userId ?? "1"
    return demoUsers.get(id) ?? null
  }),
  rename: action(
    async ({ request }: RemoteActionHandlerArgs<{ id: string; name: string }>) => {
      const u = demoUsers.get(request.body.id)
      if (!u) throw new Error("User not found")
      u.name = request.body.name
      return u
    }
  ),
}

export const renameUserViaNamespace = action(
  async ({ request }: RemoteActionHandlerArgs<{ id: string; name: string }>) => {
    const before = await users.get()
    try {
      const updated = await users.rename({ body: request.body })
      return { before, updated }
    } catch (e) {
      return {
        before,
        updated: {
          ok: false as const,
          error: e instanceof Error ? e.message : "Rename failed",
        },
      }
    }
  }
)
