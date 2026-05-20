import { matchRoute } from "./manifest.js"
import {
  effectiveContextStrategy,
  mergeRouteMeta,
  shouldAwaitContext,
  shouldBlockOutlet,
  shouldResolveContext,
  warnContextConfig,
  type ContextGateOptions,
} from "./routeMeta.js"
import type {
  ContextGateState,
  ContextState,
  CustomRequestContext,
  ResolveContextEvent,
  RouteManifest,
  RouteMatch,
  RouterPathPolicy,
} from "./types.js"

export type { ContextGateOptions }

export function initialContextState(
  hydrated: CustomRequestContext | null
): ContextState {
  if (hydrated && Object.keys(hydrated).length > 0) return "ready"
  return "idle"
}

export function idleContextGate(): ContextGateState {
  return { status: "idle" }
}

export function resolveContextGateState(
  match: RouteMatch | null,
  contextState: ContextState,
  requestContext: CustomRequestContext,
  options: ContextGateOptions
): ContextGateState {
  if (!match) return { status: "idle" }
  warnContextConfig(match, options)
  if (!shouldBlockOutlet(match, options)) {
    if (contextState === "ready") {
      return { status: "ready", context: requestContext }
    }
    return { status: "idle" }
  }
  if (contextState === "pending") {
    return { status: "pending", reason: "auth" }
  }
  if (contextState === "denied") {
    return { status: "denied", redirect: "/login" }
  }
  if (contextState === "ready") {
    return { status: "ready", context: requestContext }
  }
  return { status: "pending", reason: "auth" }
}

export function canLoadProtectedLeaf(
  match: RouteMatch | null,
  contextGate: ContextGateState,
  options: ContextGateOptions
): boolean {
  if (!match) return true
  if (!shouldBlockOutlet(match, options)) return true
  return contextGate.status === "ready"
}

/** During navigation, pending UI follows the target route (not the committed match). */
export function resolvePendingOutletMatch(
  match: RouteMatch | null,
  manifest: RouteManifest,
  isNavigating: boolean,
  navigationToPathname: string | undefined,
  pathPolicy?: RouterPathPolicy
): RouteMatch | null {
  if (isNavigating && navigationToPathname) {
    const toMatch = matchRoute(manifest, navigationToPathname, pathPolicy)
    if (toMatch) return toMatch
  }
  return match
}

export function shouldDeferProtectedOutlet(
  match: RouteMatch | null,
  contextGate: ContextGateState,
  options: ContextGateOptions & {
    manifest: RouteManifest
    isNavigating: boolean
    navigationToPathname?: string
    contextState: ContextState
    pathPolicy?: RouterPathPolicy
  }
): boolean {
  const outlet = resolvePendingOutletMatch(
    match,
    options.manifest,
    options.isNavigating,
    options.navigationToPathname,
    options.pathPolicy
  )
  if (!outlet || !shouldBlockOutlet(outlet, options)) return false
  if (options.contextState === "pending" || options.contextState === "denied") {
    return true
  }
  if (
    options.isNavigating &&
    shouldAwaitContext(outlet, options) &&
    options.contextState === "idle"
  ) {
    return true
  }
  return !canLoadProtectedLeaf(outlet, contextGate, options)
}

export function buildResolveEvent(
  type: ResolveContextEvent["type"],
  to: ResolveContextEvent extends { type: "navigation"; to: infer T }
    ? T
    : never,
  from: ResolveContextEvent extends { type: "navigation"; from: infer F }
    ? F
    : null
): ResolveContextEvent {
  if (type === "navigation") {
    return { type: "navigation", to: to as never, from: from as never }
  }
  if (type === "refresh") return { type: "refresh" }
  return { type: "initial" }
}

export {
  effectiveContextStrategy,
  mergeRouteMeta,
  shouldAwaitContext,
  shouldBlockOutlet,
  shouldResolveContext,
}
