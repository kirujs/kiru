import { nextIdle } from "../scheduler.js"
import { ViewTransitions } from "../viewTransitions.js"
import type { I18nLocaleRouting } from "./i18n/localeRouting.js"
import { addBase, stripBase, type RouterPathPolicy } from "./pathPolicy.js"
import {
  DEFAULT_REQUEST_LIMITS,
  parseQueryBounded,
  type ResolvedRequestLimits,
} from "./requestLimits.js"
import type { RouterQuery } from "./requestUrl.js"
import type { Signal } from "../signals/base.js"
import type {
  AfterEachHook,
  CustomRequestContext,
  NavigationFailure,
  NavigationGuard,
  RouteLocation,
  RouteLocationSnapshot,
  RouteManifest,
  RouteMatch,
  RouteMiddlewareLocation,
  RouteTreeMatchSegment,
} from "./types.js"
import { mergeRouteMeta } from "./routeMeta.js"
import type { InterceptorRegistration } from "./routeInterceptors.js"
import type { RouteInterceptState } from "./types.js"
export type { RouteTreeMatchSegment }

export function buildMatchSegments(
  match: RouteMatch | null
): RouteTreeMatchSegment[] {
  if (!match) return []
  const out: RouteTreeMatchSegment[] = []
  for (const scope of match.route.scopes) {
    out.push({
      id: scope.id,
      kind: "scope",
      meta: scope.meta,
    })
  }
  out.push({
    id: match.route.id,
    kind: "route",
    meta: match.route.meta,
  })
  return out
}

export function buildMiddlewareLocation(
  resolved: RouteLocationParts & { href: string },
  match: RouteMatch,
  segments: RouteTreeMatchSegment[]
): RouteMiddlewareLocation {
  const meta = mergeRouteMeta(match)
  return {
    pathname: match.pathname,
    params: match.params,
    query: resolved.query,
    hash: resolved.hash,
    href: resolved.href,
    routeId: match.route.id,
    meta,
    segments,
  }
}

export type RouteLocationParts = {
  pathname: string
  hash: string
  query: RouterQuery
  /** Set when locale prefixes are stripped from the URL for route matching. */
  locale?: string | null
}

export function buildQueryString(query: RouterQuery): string {
  const params = new URLSearchParams()
  for (const [key, values] of Object.entries(query)) {
    for (const value of values) params.append(key, value)
  }
  return params.toString()
}

/** `?foo=bar` search string for loader context from router query state. */
export function formatRouterSearch(query: RouterQuery): string {
  const qs = buildQueryString(query)
  return qs ? `?${qs}` : ""
}

export function parseResolvedLocation(
  url: URL,
  baseUrl: string,
  limits: ResolvedRequestLimits = DEFAULT_REQUEST_LIMITS
): RouteLocationParts & { href: string } {
  const pathname = stripBase(url.pathname, baseUrl)
  const query = parseQueryBounded(url.search, limits)
  return {
    pathname,
    hash: url.hash,
    query,
    href: buildHistoryHref({ pathname, hash: url.hash, query }, baseUrl),
  }
}

/** Browser history URL for a router location (pathname is app-relative). */
export function buildHistoryHref(
  parts: RouteLocationParts,
  baseUrl: string
): string {
  return `${addBase(parts.pathname, baseUrl)}${formatRouterSearch(
    parts.query
  )}${parts.hash}`
}

export function formatNavigationSnapshotLabel(
  snap: RouteLocationSnapshot | null | undefined
): string {
  if (!snap) return ""
  const keys = Object.keys(snap.params)
  if (!keys.length) return snap.pathname
  return `${snap.pathname}?${keys
    .map((k) => `${k}=${snap.params[k]}`)
    .join("&")}`
}

export async function runTransition(
  callback: () => void | Promise<void>,
  enableTransition: boolean,
  signal?: AbortSignal
) {
  if (!enableTransition) {
    await callback()
    await new Promise<void>((resolve) => nextIdle(resolve))
    return
  }
  await ViewTransitions.run(callback, { signal })
}

export type ScrollStackState = [number, number][]

const SCROLL_STACK_KEY = "__kiru_router_scroll_stack__"

export function readScrollStack(): ScrollStackState {
  if (typeof sessionStorage === "undefined") return []
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(SCROLL_STACK_KEY) || "[]"
    ) as ScrollStackState
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeScrollStack(stack: ScrollStackState) {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(SCROLL_STACK_KEY, JSON.stringify(stack))
}

export function ensureHistoryIndex(history: History): number {
  const state = history.state as unknown
  if (
    typeof state === "object" &&
    state !== null &&
    "index" in state &&
    typeof state.index === "number"
  ) {
    return state.index
  }
  const index = history.length - 1
  history.replaceState({ ...history.state, index }, "", window.location.href)
  return index
}

export type NavigationPipelineDeps = {
  manifest: RouteManifest
  resolvedPathPolicy: Required<RouterPathPolicy>
  normalizedBaseUrl: string
  origin: string
  pathname: Signal<string>
  hash: Signal<string>
  query: Signal<RouterQuery>
  match: Signal<RouteMatch | null>
  params: Signal<Record<string, string>>
  matches: Signal<RouteTreeMatchSegment[]>
  requestContext: { value: CustomRequestContext }
  afterEachHooks: AfterEachHook[]
  leaveByRoute: Map<string, NavigationGuard[]>
  updateByRoute: Map<string, NavigationGuard[]>
  componentEnterGuards: NavigationGuard[]
  history: History
  navToken: { value: number }
  /** Aborts in-flight outlet/loader work when a new navigation starts. */
  navAbortController: { current: AbortController | null }
  historyIndex: { value: number }
  scrollStack: { value: ScrollStackState }
  saveScrollAt: (index: number) => void
  commitLocation: (next: RouteLocationParts) => void
  setValidatedQuery: (data: unknown | null) => void
  setValidatedRouteParams: (params: Record<string, unknown> | null) => void
  buildMatchSegments: (match: RouteMatch | null) => RouteTreeMatchSegment[]
  locationFromMatch: (match: RouteMatch | null) => RouteLocation | null
  snapshotFromParts: (
    parts: RouteLocationParts,
    params: Record<string, string>
  ) => RouteLocationSnapshot
  currentLocationParts: () => RouteLocationParts
  setLastNavigation: (entry: {
    to: RouteLocation
    from: RouteLocation | null
    failure?: NavigationFailure
  }) => void
  localeRouting?: I18nLocaleRouting
  locale?: Signal<string>
  onLocaleChange?: (locale: string) => void
  /** Set after middleware `{ error }` once location is committed (cleared by commitLocation). */
  setOutletRenderError?: (err: Error | null) => void
  interceptState?: { value: RouteInterceptState | null }
  interceptorRegistrations?: InterceptorRegistration[]
  commitInterceptLocation?: (input: {
    target: RouteLocationParts & { href: string }
    targetMatch: RouteMatch
    backgroundMatch: RouteMatch
    registration: InterceptorRegistration
    signal: AbortSignal
  }) => Promise<void>
  dismissIntercept?: (options?: { skipHistoryBack?: boolean }) => void
  requestLimits?: ResolvedRequestLimits
}

export type NavigateInternalOptions = {
  replace: boolean
  fromPopstate: boolean
  enableTransition?: boolean
  /** When false, skip route interceptors. Default true. */
  intercept?: boolean
}
