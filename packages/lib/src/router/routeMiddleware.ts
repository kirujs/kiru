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
  const chain = collectMiddlewareChain(input.match)
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

/** Normalize `middleware.ts` namespace imports from file-based route codegen. */
export function collectRouteMiddlewareModule(module: {
  default?: RouteMiddleware | RouteMiddleware[]
  middleware?: RouteMiddleware | RouteMiddleware[]
}): RouteMiddleware[] {
  const chain: RouteMiddleware[] = []
  const add = (value: RouteMiddleware | RouteMiddleware[] | undefined) => {
    if (value == null) return
    if (Array.isArray(value)) chain.push(...value)
    else chain.push(value)
  }
  add(module.default)
  add(module.middleware)
  return chain
}
