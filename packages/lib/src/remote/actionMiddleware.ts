import type { CustomRequestContext } from "../router/types.js"

export type RemoteActionMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"

/** Pre-validation input shared with action handlers (request-shaped surface). */
export type ActionMiddlewareContext = {
  request: {
    body: unknown
    query: Record<string, string | string[]>
    headers: Record<string, string>
  }
  context: CustomRequestContext
  signal: AbortSignal
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
