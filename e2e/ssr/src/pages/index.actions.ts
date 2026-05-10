import { action } from "kiru/remote/action"

export const getServerMessage = action(async (ctx, _input: unknown) => {
  return `hello from server (${ctx.user?.name ?? "unknown"})`
})
