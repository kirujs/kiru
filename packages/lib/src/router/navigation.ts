import { nextIdle } from "../scheduler.js"
import { ViewTransitions } from "../viewTransitions.js"
import { matchRoute } from "./manifest.js"
import {
  parseAppLocation,
  resolveInvalidLocaleRedirect,
  shouldRejectInvalidLocale,
  type AppPathSplitResult,
} from "./i18n/routing.js"
import type { I18nLocaleRouting } from "./i18n/localeRouting.js"
import { addBase, stripBase, type RouterPathPolicy } from "./pathPolicy.js"
import { __DEV__ } from "../env.js"
import {
  checkUrlWithinLimits,
  DEFAULT_REQUEST_LIMITS,
  parseQueryBounded,
  type ResolvedRequestLimits,
} from "./requestLimits.js"
import { warnOnce } from "./devWarnings.dev.js"
import type { RouterQuery } from "./requestUrl.js"
import type { Signal } from "../signals/base.js"
import type {
  AfterEachHook,
  CurrentNavigation,
  CustomRequestContext,
  NavigationFailure,
  NavigationGuard,
  NavigationResult,
  RouteLocation,
  RouteLocationSnapshot,
  RouteManifest,
  RouteMatch,
  RouteMiddlewareLocation,
  RouteTreeMatchSegment,
} from "./types.js"
import { RouteMiddlewareHttpError } from "./types.js"
import { runEnterGuards, runGuards, toRedirect } from "./runNavigationGuards.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"
import { collectMiddlewareChain, mergeRouteMeta } from "./routeMeta.js"
import { ensureResolvedRouteLayersForMatch } from "./routeLayerResolution.js"
import { runRouteMiddleware, toMiddlewareRedirect } from "./routeMiddleware.js"
import {
  findMatchingInterceptor,
  type InterceptorRegistration,
  type KiruHistoryInterceptState,
} from "./routeInterceptors.js"
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
  isNavigating: Signal<boolean>
  currentNavigation: Signal<CurrentNavigation | null>
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
    requestContext,
    afterEachHooks,
    leaveByRoute,
    updateByRoute,
    componentEnterGuards,
    history,
    navToken,
    navAbortController,
    historyIndex,
    saveScrollAt,
    commitLocation,
    setValidatedQuery,
    setValidatedRouteParams,
    locationFromMatch,
    snapshotFromParts,
    currentLocationParts,
    setLastNavigation,
    localeRouting,
    locale,
    onLocaleChange,
    setOutletRenderError,
    interceptorRegistrations,
    commitInterceptLocation,
    requestLimits = DEFAULT_REQUEST_LIMITS,
  } = deps

  const navigateInternal = async (
    targetUrl: URL,
    {
      replace,
      fromPopstate,
      enableTransition = transitionsEnabled,
      intercept: allowIntercept = true,
    }: NavigateInternalOptions
  ): Promise<NavigationResult> => {
    const urlLimit = checkUrlWithinLimits(
      targetUrl.pathname,
      targetUrl.search,
      requestLimits
    )
    if (urlLimit) {
      if (__DEV__) {
        warnOnce(
          "nav-request-limit",
          `[kiru] navigation rejected: ${urlLimit.reason}`
        )
      }
      return { status: "cancelled" }
    }

    navAbortController.current?.abort()
    const navAbort = new AbortController()
    navAbortController.current = navAbort
    const token = ++navToken.value
    isNavigating.value = true
    const resolved = localeRouting
      ? parseAppLocation(
          targetUrl,
          normalizedBaseUrl,
          localeRouting,
          resolvedPathPolicy,
          requestLimits
        )
      : parseResolvedLocation(targetUrl, normalizedBaseUrl, requestLimits)
    const invalidLocale = localeRouting
      ? (
          resolved as {
            invalidLocale?: Extract<
              AppPathSplitResult,
              { kind: "invalid-locale" }
            >
            wrongDomain?: Extract<AppPathSplitResult, { kind: "wrong-domain" }>
          }
        ).invalidLocale
      : undefined
    const wrongDomain = localeRouting
      ? (
          resolved as {
            wrongDomain?: Extract<AppPathSplitResult, { kind: "wrong-domain" }>
          }
        ).wrongDomain
      : undefined
    if (localeRouting && wrongDomain) {
      return navigateInternal(new URL(wrongDomain.location), {
        replace: true,
        fromPopstate: false,
      })
    }
    if (localeRouting && invalidLocale) {
      if (!shouldRejectInvalidLocale(localeRouting)) {
        const location = resolveInvalidLocaleRedirect(
          invalidLocale,
          localeRouting,
          resolvedPathPolicy,
          {
            host: targetUrl.host,
            protocol: targetUrl.protocol,
            baseUrl: normalizedBaseUrl,
          }
        )
        const target = location.startsWith("http")
          ? location
          : addBase(location, normalizedBaseUrl) +
            targetUrl.search +
            targetUrl.hash
        return navigateInternal(new URL(target, origin), {
          replace: true,
          fromPopstate: false,
        })
      }
    }
    if (localeRouting && locale && resolved.locale) {
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
      from: fromMatch ? snapshotFromParts(fromParts, fromMatch.params) : null,
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

    const abortNavigationWork = () => {
      if (!navAbort.signal.aborted) navAbort.abort()
    }

    const handlePopstateCancel = () => {
      if (!fromPopstate) return
      const restoreHref = buildHistoryHref(fromParts, normalizedBaseUrl)
      history.pushState(null, "", restoreHref)
      commitLocation(fromParts)
    }

    const runRedirect = async (
      redirectTo: Parameters<typeof toRedirect>[0]
    ): Promise<NavigationResult> => {
      failure = { type: "redirect", to: redirectTo }
      const r = toRedirect(redirectTo)
      const nextUrl = r.path.includes("://")
        ? new URL(r.path)
        : new URL(r.path, origin)
      return navigateInternal(nextUrl, {
        replace: r.replace ?? true,
        fromPopstate: false,
      })
    }

    try {
      const isLeavingRoute =
        !!fromMatch && (!toMatch || fromMatch.route.id !== toMatch.route.id)
      const leaveList =
        isLeavingRoute && fromMatch
          ? leaveByRoute.get(fromMatch.route.id) ?? []
          : []
      if (leaveList.length) {
        const g0 = await runGuards(leaveList, to, from)
        if (g0.type === "cancel") {
          failure = { type: "cancelled" }
          abortNavigationWork()
          handlePopstateCancel()
          return { status: "cancelled" }
        }
        if (g0.type === "redirect") return runRedirect(g0.to)
      }

      const isUpdatingRoute =
        !!fromMatch &&
        !!toMatch &&
        fromMatch.route.id === toMatch.route.id &&
        JSON.stringify(fromMatch.params) !== JSON.stringify(toMatch.params)
      const updateList =
        isUpdatingRoute && fromMatch
          ? updateByRoute.get(fromMatch.route.id) ?? []
          : []
      if (updateList.length) {
        const gu = await runGuards(updateList, to, from)
        if (gu.type === "cancel") {
          failure = { type: "cancelled" }
          abortNavigationWork()
          handlePopstateCancel()
          return { status: "cancelled" }
        }
        if (gu.type === "redirect") return runRedirect(gu.to)
      }

      const isEnteringNewRoute =
        !fromMatch || !toMatch || fromMatch.route.id !== toMatch.route.id

      const fromSnapshot = fromMatch
        ? snapshotFromParts(fromParts, fromMatch.params)
        : null

      if (toMatch) {
        await ensureResolvedRouteLayersForMatch(toMatch)
      }
      if (toMatch && collectMiddlewareChain(toMatch).length > 0) {
        const segments = toMatch ? buildMatchSegments(toMatch) : []
        const mwTo = toMatch
          ? buildMiddlewareLocation(resolved, toMatch, segments)
          : {
              pathname: targetPath,
              params: {},
              query: resolved.query,
              hash: resolved.hash,
              href: resolved.href,
              routeId: "",
              meta: {},
              segments: [],
            }
        const mwFrom =
          fromMatch && fromSnapshot
            ? buildMiddlewareLocation(
                {
                  pathname: fromParts.pathname,
                  hash: fromParts.hash,
                  query: fromParts.query,
                  href: "",
                },
                fromMatch,
                buildMatchSegments(fromMatch)
              )
            : null
        if (mwFrom && !mwFrom.href) {
          mwFrom.href = buildHistoryHref(fromParts, normalizedBaseUrl)
        }
        const mw = await runRouteMiddleware({
          to: mwTo,
          from: mwFrom,
          context: requestContext.value,
          match: toMatch,
        })
        if (mw.type === "redirect") {
          return runRedirect(toMiddlewareRedirect(mw.to))
        }
        if (mw.type === "abort") {
          failure = { type: "cancelled" }
          abortNavigationWork()
          handlePopstateCancel()
          return { status: "cancelled" }
        }
        if (mw.type === "error") {
          const err = new RouteMiddlewareHttpError(mw.status, mw.body)
          failure = { type: "error", error: err }
          if (token !== navToken.value) {
            abortNavigationWork()
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
          await runTransition(
            () => commitLocation(resolved),
            enableTransition,
            navAbort.signal
          )
          setOutletRenderError?.(err)
          navResult = { status: "errored", error: err }
          return navResult
        }
      }

      if (toMatch) {
        const searchCheck = await validateSearchForMatch(
          toMatch,
          resolved.query,
          {
            hash: resolved.hash,
          }
        )
        if (!searchCheck.ok) {
          if (searchCheck.failure.kind === "redirect") {
            return runRedirect(searchCheck.failure.location)
          }
          failure = { type: "cancelled" }
          abortNavigationWork()
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
        abortNavigationWork()
        return { status: "cancelled" }
      }

      const interceptor =
        allowIntercept &&
        !fromPopstate &&
        fromMatch &&
        toMatch &&
        interceptorRegistrations &&
        commitInterceptLocation
          ? findMatchingInterceptor(
              interceptorRegistrations,
              fromMatch,
              toMatch
            )
          : null

      if (interceptor && fromMatch && toMatch && commitInterceptLocation) {
        const commitIntercept = commitInterceptLocation
        const kiruIntercept: KiruHistoryInterceptState = {
          registrationId: interceptor.id,
          background: { ...fromParts },
          backgroundParams: { ...fromMatch.params },
        }
        if (replace) {
          saveScrollAt(historyIndex.value)
          history.replaceState(
            {
              ...history.state,
              index: historyIndex.value,
              kiruIntercept,
            },
            "",
            resolved.href
          )
        } else {
          saveScrollAt(historyIndex.value)
          const nextIndex = historyIndex.value + 1
          deps.scrollStack.value = deps.scrollStack.value.slice(0, nextIndex)
          history.pushState(
            {
              ...history.state,
              index: nextIndex,
              kiruIntercept,
            },
            "",
            resolved.href
          )
          historyIndex.value = nextIndex
        }
        await runTransition(
          async () => {
            await commitIntercept({
              target: resolved,
              targetMatch: toMatch,
              backgroundMatch: fromMatch,
              registration: interceptor,
              signal: navAbort.signal,
            })
          },
          enableTransition,
          navAbort.signal
        )
        if (token !== navToken.value) {
          abortNavigationWork()
          return { status: "cancelled" }
        }
        navResult = { status: "intercepted" }
      } else {
        // Hard commit: commitLocation clears intercept atomically. Do not
        // dismissIntercept first — that resets match/pathname to background
        // mid-flight while the URL already shows the intercept target.
        if (replace) {
          saveScrollAt(historyIndex.value)
          history.replaceState(
            {
              ...history.state,
              index: historyIndex.value,
              kiruIntercept: undefined,
            },
            "",
            resolved.href
          )
        } else {
          saveScrollAt(historyIndex.value)
          const nextIndex = historyIndex.value + 1
          deps.scrollStack.value = deps.scrollStack.value.slice(0, nextIndex)
          history.pushState(
            { ...history.state, index: nextIndex, kiruIntercept: undefined },
            "",
            resolved.href
          )
          historyIndex.value = nextIndex
        }
        await runTransition(
          () => commitLocation(resolved),
          enableTransition,
          navAbort.signal
        )

        if (isEnteringNewRoute && componentEnterGuards.length) {
          await runEnterGuards(componentEnterGuards, to, from)
        }
        navResult = { status: "committed" }
      }
    } catch (error) {
      failure = { type: "error", error }
      navResult = { status: "errored", error }
      abortNavigationWork()
      handlePopstateCancel()
    } finally {
      if (token === navToken.value) {
        if (
          navResult.status !== "committed" &&
          navResult.status !== "intercepted"
        ) {
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
