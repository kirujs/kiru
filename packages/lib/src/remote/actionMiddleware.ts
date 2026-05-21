import type { CustomRequestContext } from "../router/types.js"

export type RemoteActionMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"

export type ActionMiddlewareContext = {
  request: Request
  method: RemoteActionMethod
  context: CustomRequestContext
  signal: AbortSignal
  body: unknown
  query: Record<string, string | string[]>
}

export type ActionMiddleware = (
  ctx: ActionMiddlewareContext
) => void | Promise<void>

export async function runActionMiddleware(
  chain: ActionMiddleware[],
  ctx: ActionMiddlewareContext
): Promise<void> {
  for (const mw of chain) {
    await mw(ctx)
  }
}
