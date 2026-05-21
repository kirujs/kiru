import { action, RemoteActionHandlerArgs } from "kiru/remote"

const labels = new Map<string, string>([["demo", "keep-me"]])

export const api = {
  getEcho: action.get(async ({ context }) => {
    return `echo:${context.user?.name ?? "unknown"}`
  }),
  removeLabel: action.delete(async ({ body: id }: RemoteActionHandlerArgs<string>) => {
    const had = labels.has(id)
    labels.delete(id)
    return { removed: id, had }
  }),
  metrics: {
    ping: action.get(async () => ({ pong: true as const })),
  },
}

/** Single HTTP entry; calls nested namespaced actions in-process. */
export const runPipeline = action.post(async () => {
  const echo = await api.getEcho()
  const ping = await api.metrics.ping()
  return { echo, ping, nested: true }
})
