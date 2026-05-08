import { getRequestContext } from "kiru/remote"

export async function getServerMessage(): Promise<string> {
  const ctx = getRequestContext()
  return `hello from server (${ctx.user?.name ?? "unknown"})`
}
