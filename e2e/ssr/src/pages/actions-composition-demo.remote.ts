import { getRequestEvent, mutation, query } from "kiru/remote"

const labels = new Map<string, string>([["demo", "keep-me"]])

const idSchema = {
  parse: (input: unknown) => {
    if (typeof input !== "string") throw new Error("expected string")
    return input
  },
}

export const api = {
  getEcho: query(async () => {
    const { context } = getRequestEvent()
    return `echo:${context.user?.name ?? "unknown"}`
  }),
  getLabel: query(idSchema, async (id) => labels.get(id) ?? null),
  removeLabel: mutation(idSchema, async (id) => {
    const had = labels.has(id)
    labels.delete(id)
    return { removed: id, had }
  }),
  metrics: {
    ping: query(async () => ({ pong: true as const })),
  },
}

/** Single HTTP entry; calls nested namespaced remotes in-process. */
export const runPipeline = mutation(async () => {
  const echo = await api.getEcho()
  const ping = await api.metrics.ping()
  return { echo, ping, nested: true }
})
