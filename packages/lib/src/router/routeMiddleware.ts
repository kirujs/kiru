import { collectMiddlewareChain } from "./routeMeta.js"
import type {
  CustomRequestContext,
  RouteMatch,
  RouteMeta,
  RouteMiddleware,
  RouteMiddlewareContext,
  RouteMiddlewareRedirect,
  RouteMiddlewareTo,
} from "./types.js"

export function toMiddlewareRedirect(value: RouteMiddlewareRedirect): {
  path: string
  replace?: boolean
} {
  if (typeof value === "string") return { path: value }
  return value
}

export async function runRouteMiddleware(input: {
  to: RouteMiddlewareTo
  from: RouteMiddlewareTo | null
  meta: RouteMeta
  context: CustomRequestContext
  request?: Request
  globalMiddleware: RouteMiddleware[]
  match: RouteMatch | null
}): Promise<
  | { type: "continue" }
  | { type: "redirect"; to: RouteMiddlewareRedirect }
  | { type: "error"; status: number; body?: string }
  | { type: "abort" }
> {
  const ctx: RouteMiddlewareContext = {
    meta: input.meta,
    to: input.to,
    from: input.from,
    request: input.request,
    context: input.context,
  }
  const chain = [
    ...input.globalMiddleware,
    ...collectMiddlewareChain(input.match),
  ]
  for (const mw of chain) {
    const out = await mw(ctx)
    if (!out) continue
    if ("redirect" in out) return { type: "redirect", to: out.redirect }
    if ("error" in out)
      return { type: "error", status: out.error, body: out.body }
    if ("abort" in out) return { type: "abort" }
  }
  return { type: "continue" }
}

export function defineRouteMiddleware<T extends RouteMiddleware>(fn: T): T {
  return fn
}
