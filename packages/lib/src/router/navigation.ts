import { nextIdle } from "../scheduler.js"
import { ViewTransitions } from "../viewTransitions.js"
import { matchRoute } from "./manifest.js"
import {
  parseAppLocation,
  resolveInvalidLocaleRedirect,
  shouldRejectInvalidLocale,
  type AppPathSplitResult,
} from "./i18n/routing.js"
import type { SiteLocales } from "./localePolicy.js"
import { addBase, stripBase, type RouterPathPolicy } from "./pathPolicy.js"
import { parseQuery, type RouterQuery } from "./requestUrl.js"
import type { Signal } from "../signals/base.js"
import type {
  AfterEachHook,
  CurrentNavigation,
  NavigationFailure,
  NavigationGuard,
  NavigationResult,
  RouteLocation,
  RouteLocationSnapshot,
  RouteManifest,
  RouteMatch,
} from "./types.js"
import { runGuards, toRedirect } from "./runNavigationGuards.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"

export type RouteTreeMatchSegment = {
  id: string
  kind: "scope" | "route"
  meta: Record<string, unknown>
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

export function parseResolvedLocation(
  url: URL,
  baseUrl: string
): RouteLocationParts & { href: string } {
  const pathname = stripBase(url.pathname, baseUrl)
  return {
    pathname,
    hash: url.hash,
    query: parseQuery(url.search),
    href: `${addBase(pathname, baseUrl)}${url.search}${url.hash}`,
  }
}

export function formatNavigationSnapshotLabel(
  snap: RouteLocationSnapshot | null | undefined
): string {
  if (!snap) return ""
  const keys = Object.keys(snap.params)
  if (!keys.length) return snap.pathname
  return `${snap.pathname}?${keys.map((k) => `${k}=${snap.params[k]}`).join("&")}`
}

export async function runTransition(
  callback: () => void,
  enableTransition: boolean,
  signal?: AbortSignal
) {
  if (!enableTransition) {
    callback()
    await new Promise<void>((resolve) => nextIdle(resolve))
    return
  }
  await ViewTransitions.run(callback, { signal })
}

export type ScrollStackState = [number, number][]

export const SCROLL_STACK_KEY = "__kiru_router_scroll_stack__"

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
  isNavigating: Signal<boolean>
  currentNavigation: Signal<CurrentNavigation | null>
  beforeEachGuards: NavigationGuard[]
  beforeResolveGuards: NavigationGuard[]
  afterEachHooks: AfterEachHook[]
  leaveByRoute: Map<string, NavigationGuard[]>
  updateByRoute: Map<string, NavigationGuard[]>
  componentEnterGuards: NavigationGuard[]
  history: History
  navToken: { value: number }
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
  siteLocales?: SiteLocales
  locale?: Signal<string>
  onLocaleChange?: (locale: string) => void
}

export type NavigateInternalOptions = {
  replace: boolean
  fromPopstate: boolean
  enableTransition?: boolean
}

export function createNavigateInternal(
  deps: NavigationPipelineDeps,
  transitionsEnabled: boolean
) {
  const {
    manifest,
    resolvedPathPolicy,
    normalizedBaseUrl,
    origin,
    match,
    isNavigating,
    currentNavigation,
    beforeEachGuards,
    beforeResolveGuards,
    afterEachHooks,
    leaveByRoute,
    updateByRoute,
    componentEnterGuards,
    history,
    navToken,
    historyIndex,
    saveScrollAt,
    commitLocation,
    setValidatedQuery,
    setValidatedRouteParams,
    locationFromMatch,
    snapshotFromParts,
    currentLocationParts,
    setLastNavigation,
    siteLocales,
    locale,
    onLocaleChange,
  } = deps

  const navigateInternal = async (
    targetUrl: URL,
    {
      replace,
      fromPopstate,
      enableTransition = transitionsEnabled,
    }: NavigateInternalOptions
  ): Promise<NavigationResult> => {
    const token = ++navToken.value
    isNavigating.value = true
    const resolved = siteLocales
      ? parseAppLocation(
          targetUrl,
          normalizedBaseUrl,
          siteLocales,
          resolvedPathPolicy
        )
      : parseResolvedLocation(targetUrl, normalizedBaseUrl)
    const invalidLocale = siteLocales
      ? (
          resolved as {
            invalidLocale?: Extract<
              AppPathSplitResult,
              { kind: "invalid-locale" }
            >
          }
        ).invalidLocale
      : undefined
    if (siteLocales && invalidLocale) {
      if (!shouldRejectInvalidLocale(siteLocales)) {
        const location = resolveInvalidLocaleRedirect(
          invalidLocale,
          siteLocales,
          resolvedPathPolicy
        )
        return navigateInternal(
          new URL(addBase(location, normalizedBaseUrl) + targetUrl.search + targetUrl.hash, origin),
          { replace: true, fromPopstate: false }
        )
      }
    }
    if (siteLocales && locale && resolved.locale) {
      if (locale.peek() !== resolved.locale) {
        locale.value = resolved.locale
        onLocaleChange?.(resolved.locale)
      }
    }
    const targetPath = resolved.pathname
    const fromMatch = match.peek()
    const fromParts = currentLocationParts()
    const from = locationFromMatch(fromMatch)
    const toMatch = matchRoute(manifest, targetPath, resolvedPathPolicy)

    const to: RouteLocation = toMatch
      ? locationFromMatch(toMatch)!
      : { pathname: targetPath, params: {} }

    currentNavigation.value = {
      from: fromMatch
        ? snapshotFromParts(fromParts, fromMatch.params)
        : null,
      to: snapshotFromParts(
        {
          pathname: resolved.pathname,
          hash: resolved.hash,
          query: resolved.query,
        },
        toMatch?.params ?? {}
      ),
    }

    let failure: NavigationFailure | undefined
    let navResult: NavigationResult = { status: "committed" }

    const handlePopstateCancel = () => {
      if (fromPopstate && from) {
        history.pushState(null, "", addBase(from.pathname, normalizedBaseUrl))
        commitLocation(currentLocationParts())
      }
    }

    const runRedirect = async (
      redirectTo: Parameters<typeof toRedirect>[0]
    ): Promise<NavigationResult> => {
      failure = { type: "redirect", to: redirectTo }
      const r = toRedirect(redirectTo)
      return navigateInternal(
        new URL(addBase(r.path, normalizedBaseUrl), origin),
        {
          replace: r.replace ?? true,
          fromPopstate: false,
        }
      )
    }

    try {
      const isLeavingRoute =
        !!fromMatch && (!toMatch || fromMatch.route.id !== toMatch.route.id)
      const leaveList =
        isLeavingRoute && fromMatch
          ? (leaveByRoute.get(fromMatch.route.id) ?? [])
          : []
      if (leaveList.length) {
        const g0 = await runGuards(leaveList, to, from)
        if (g0.type === "cancel") {
          failure = { type: "cancelled" }
          handlePopstateCancel()
          return { status: "cancelled" }
        }
        if (g0.type === "redirect") return runRedirect(g0.to)
      }

      const g1 = await runGuards(beforeEachGuards, to, from)
      if (g1.type === "cancel") {
        failure = { type: "cancelled" }
        handlePopstateCancel()
        return { status: "cancelled" }
      }
      if (g1.type === "redirect") return runRedirect(g1.to)

      const isUpdatingRoute =
        !!fromMatch &&
        !!toMatch &&
        fromMatch.route.id === toMatch.route.id &&
        JSON.stringify(fromMatch.params) !== JSON.stringify(toMatch.params)
      const updateList =
        isUpdatingRoute && fromMatch
          ? (updateByRoute.get(fromMatch.route.id) ?? [])
          : []
      if (updateList.length) {
        const gu = await runGuards(updateList, to, from)
        if (gu.type === "cancel") {
          failure = { type: "cancelled" }
          handlePopstateCancel()
          return { status: "cancelled" }
        }
        if (gu.type === "redirect") return runRedirect(gu.to)
      }

      const routeGuards = toMatch?.route.beforeEnter ?? []
      const isEnteringNewRoute =
        !fromMatch || !toMatch || fromMatch.route.id !== toMatch.route.id
      if (isEnteringNewRoute && routeGuards.length) {
        const g2 = await runGuards(routeGuards, to, from)
        if (g2.type === "cancel") {
          failure = { type: "cancelled" }
          handlePopstateCancel()
          return { status: "cancelled" }
        }
        if (g2.type === "redirect") return runRedirect(g2.to)
      }

      const beforeActivate = toMatch?.route.beforeActivate ?? []
      if (isEnteringNewRoute && beforeActivate.length) {
        const ga = await runGuards(beforeActivate, to, from)
        if (ga.type === "cancel") {
          failure = { type: "cancelled" }
          handlePopstateCancel()
          return { status: "cancelled" }
        }
        if (ga.type === "redirect") return runRedirect(ga.to)
      }

      const g3 = await runGuards(beforeResolveGuards, to, from)
      if (g3.type === "cancel") {
        failure = { type: "cancelled" }
        handlePopstateCancel()
        return { status: "cancelled" }
      }
      if (g3.type === "redirect") return runRedirect(g3.to)

      if (toMatch) {
        const searchCheck = await validateSearchForMatch(toMatch, resolved.query, {
          hash: resolved.hash,
        })
        if (!searchCheck.ok) {
          if (searchCheck.failure.kind === "redirect") {
            return runRedirect(searchCheck.failure.location)
          }
          failure = { type: "cancelled" }
          handlePopstateCancel()
          return { status: "cancelled" }
        }
        setValidatedQuery(searchCheck.validatedQuery ?? null)
        setValidatedRouteParams(searchCheck.params)
      } else {
        setValidatedQuery(null)
        setValidatedRouteParams(null)
      }

      if (token !== navToken.value) {
        return { status: "cancelled" }
      }

      if (replace) {
        saveScrollAt(historyIndex.value)
        history.replaceState(
          { ...history.state, index: historyIndex.value },
          "",
          resolved.href
        )
      } else {
        saveScrollAt(historyIndex.value)
        const nextIndex = historyIndex.value + 1
        deps.scrollStack.value = deps.scrollStack.value.slice(0, nextIndex)
        history.pushState(
          { ...history.state, index: nextIndex },
          "",
          resolved.href
        )
        historyIndex.value = nextIndex
      }
      await runTransition(() => commitLocation(resolved), enableTransition)

      if (isEnteringNewRoute && componentEnterGuards.length) {
        await runGuards(componentEnterGuards, to, from)
      }
      navResult = { status: "committed" }
    } catch (error) {
      failure = { type: "error", error }
      navResult = { status: "errored", error }
      handlePopstateCancel()
    } finally {
      if (token === navToken.value) {
        if (navResult.status !== "committed") {
          isNavigating.value = false
          currentNavigation.value = null
        }
        setLastNavigation({ to, from, failure })
        for (const hook of afterEachHooks) {
          try {
            hook(to, from, failure)
          } catch {
            // afterEach must not break navigation
          }
        }
      }
    }
    return navResult
  }

  return navigateInternal
}
