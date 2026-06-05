import { getRequestEvent, mutation, query, type Schema } from "kiru/remote"
import { test } from "./test"
import { isRecord, type SandboxRequestContext } from "./types.js"

console.log(test)

const mySchema: Schema<{ name: string }> = {
  parse: (input) => {
    if (!isRecord(input) || typeof input.name !== "string") {
      throw new Error("Invalid input")
    }
    return { name: input.name }
  },
}

export const getSandboxServerEcho = query(async () => {
  const { context } = getRequestEvent()
  const name = context.user?.name ?? "guest"
  return `Remote OK: ${name} ${test}`
})

export const getServerEcho = mutation(mySchema, async ({ name }) => `Echo ${name}`)

const renameSchema: Schema<{ id: string; name: string }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const id = input.id
    const name = input.name
    if (typeof id !== "string" || !id) throw new Error("Invalid id")
    if (typeof name !== "string" || !name.trim()) throw new Error("Invalid name")
    return { id, name: name.trim() }
  },
}

const demoUsers = new Map<string, { id: string; name: string }>([
  ["1", { id: "1", name: "Demo User" }],
])

export const users = {
  get: query(async () => {
    const { context } = getRequestEvent()
    const sandbox = context as SandboxRequestContext
    const id = sandbox.userId ?? sandbox.user?.id ?? "1"
    return demoUsers.get(id) ?? null
  }),
  rename: mutation(renameSchema, async ({ id, name }) => {
    const u = demoUsers.get(id)
    if (!u) throw new Error("User not found")
    u.name = name
    return u
  }),
}

export const renameUserViaNamespace = mutation(renameSchema, async (input) => {
  const before = await users.get()
  try {
    const updated = await users.rename(input)
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
})
