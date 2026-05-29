import type { CustomRequestContext } from "../router/types.js"
import { isRpcTraceEnabled, rpcTrace } from "./rpcTrace.js"

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
  for (let i = 0; i < chain.length; i++) {
    if (isRpcTraceEnabled()) {
      rpcTrace({
        channel: "action",
        phase: "middleware_start",
        meta: { index: i },
      })
    }
    await chain[i]!(ctx)
    if (isRpcTraceEnabled()) {
      rpcTrace({
        channel: "action",
        phase: "middleware_end",
        meta: { index: i },
      })
    }
  }
}
