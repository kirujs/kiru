import type { CustomRequestContext } from "../router/types.js"

export type RemoteActionMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"

/** Pre-validation input shared with action handlers (flat surface). */
export type ActionMiddlewareContext = {
  body: unknown
  query: Record<string, string | string[]>
  headers: Record<string, string>
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
