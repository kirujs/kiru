import type {
  ContextGateMode,
  ContextPendingFallback,
  ContextStrategy,
  RouteMatch,
  RouteMeta,
  RouteMiddleware,
} from "./types.js"

function mergeShallowMeta(
  ...layers: Array<Partial<RouteMeta> | undefined>
): RouteMeta {
  const out: RouteMeta = {}
  for (const layer of layers) {
    if (!layer) continue
    for (const [k, v] of Object.entries(layer)) {
      ;(out as Record<string, unknown>)[k] = v
    }
  }
  return out
}

export function mergeRouteMeta(match: RouteMatch | null): RouteMeta {
  if (!match) return {}
  let meta: RouteMeta = {}
  for (const scope of match.route.scopes) {
    meta = mergeShallowMeta(meta, scope.meta)
  }
  return mergeShallowMeta(meta, match.route.meta)
}

/** Nearest scope on match chain (leaf → root) with an explicit strategy. */
export function effectiveContextStrategy(
  match: RouteMatch | null,
  contextGate: ContextGateMode = "off"
): ContextStrategy {
  if (!match) return "inherit"
  for (let i = match.route.scopes.length - 1; i >= 0; i--) {
    const s = match.route.scopes[i].contextStrategy
    if (s) return s
  }
  if (contextGate === "block") return "block"
  return "inherit"
}

/** Nearest scope on match chain (leaf → root) with a fallback; else app default. */
export function effectiveContextPendingFallback(
  match: RouteMatch | null,
  appFallback?: ContextPendingFallback
): ContextPendingFallback | undefined {
  if (!match) return appFallback
  for (let i = match.route.scopes.length - 1; i >= 0; i--) {
    const fb = match.route.scopes[i].contextPendingFallback
    if (fb) return fb
  }
  return appFallback
}

export type ContextGateOptions = {
  contextGate: ContextGateMode
  hasResolveContext: boolean
}

export function shouldBlockOutlet(
  match: RouteMatch | null,
  options: ContextGateOptions
): boolean {
  const strategy = effectiveContextStrategy(match, options.contextGate)
  if (strategy === "block") return true
  if (strategy === "none" || strategy === "background") return false
  if (options.contextGate === "block") return true
  return false
}

export function shouldResolveContext(
  match: RouteMatch | null,
  options: ContextGateOptions
): boolean {
  if (!options.hasResolveContext || !match) return false
  const strategy = effectiveContextStrategy(match, options.contextGate)
  if (strategy === "none") return false
  if (strategy === "background" || strategy === "block") return true
  if (options.contextGate === "block") return true
  if (options.contextGate === "off") return false
  return false
}

export function shouldAwaitContext(
  match: RouteMatch | null,
  options: ContextGateOptions
): boolean {
  if (!shouldResolveContext(match, options)) return false
  const strategy = effectiveContextStrategy(match, options.contextGate)
  if (strategy === "block") return true
  if (strategy === "none" || strategy === "background") return false
  if (options.contextGate === "block") return true
  return false
}

export function collectMiddlewareChain(match: RouteMatch | null): RouteMiddleware[] {
  if (!match) return []
  const chain: RouteMiddleware[] = []
  for (const scope of match.route.scopes) {
    if (scope.middleware?.length) chain.push(...scope.middleware)
  }
  if (match.route.middleware?.length) chain.push(...match.route.middleware)
  return chain
}

export function warnContextConfig(
  match: RouteMatch | null,
  options: ContextGateOptions
): void {
  if (!match) return
  const strategy = effectiveContextStrategy(match, options.contextGate)
  if (strategy === "block" && !options.hasResolveContext) {
    // eslint-disable-next-line no-console
    console.warn(
      "[kiru] contextStrategy 'block' requires createRouter({ resolveContext })."
    )
  }
}
