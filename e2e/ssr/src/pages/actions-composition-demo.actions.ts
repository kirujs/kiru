import { action, RemoteActionHandlerArgs } from "kiru/remote"

const labels = new Map<string, string>([["demo", "keep-me"]])

export const api = {
  getEcho: action(async ({ context }) => {
    return `echo:${context.user?.name ?? "unknown"}`
  }),
  removeLabel: action(async ({ request }: RemoteActionHandlerArgs<string>) => {
    const id = request.body
    const had = labels.has(id)
    labels.delete(id)
    return { removed: id, had }
  }),
  metrics: {
    ping: action(async () => ({ pong: true as const })),
  },
}

/** Single HTTP entry; calls nested namespaced actions in-process. */
export const runPipeline = action(async () => {
  const echo = await api.getEcho()
  const ping = await api.metrics.ping()
  return { echo, ping, nested: true }
})
