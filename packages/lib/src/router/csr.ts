import { signal } from "../signals/base.js"
import { matchRoute } from "./manifest.js"
import {
  addBase,
  formatPathname,
  resolvePathPolicy,
  stripBase,
  type RouterPathPolicy,
} from "./pathPolicy.js"
import {
  parseQuery,
  splitRouterTo,
  type RouterQuery,
} from "./requestUrl.js"
import type {
  AfterEachHook,
  ContextGateMode,
  ContextGateState,
  ContextPendingFallback,
  ContextState,
  CurrentNavigation,
  CustomRequestContext,
  NavigationFailure,
  NavigationGuard,
  NavigationResult,
  ResolveContextEvent,
  RouteLocation,
  RouteLocationSnapshot,
  RouteManifest,
  RouteMatch,
  RouteTreeDefinition,
} from "./types.js"
import { readHydratedRequestContext } from "./requestContext.js"
import {
  canLoadProtectedLeaf,
  idleContextGate,
  initialContextState,
  resolveContextGateState,
} from "./contextGate.js"
import { mergeRouteMeta } from "./routeMeta.js"
import { runContextResolve } from "./contextResolve.js"
import type { ContextGateOptions } from "./routeMeta.js"
import {
  buildMatchSegments,
  buildQueryString,
  createNavigateInternal,
  formatRouterSearch,
  ensureHistoryIndex,
  formatNavigationSnapshotLabel,
  parseResolvedLocation,
  readScrollStack,
  writeScrollStack,
  type RouteLocationParts,
  type RouteTreeMatchSegment,
  type ScrollStackState,
} from "./navigation.js"
import { compileRouteTree } from "./manifest.js"
import { resolveNavigateTarget } from "./routePaths.js"
import type { Router } from "./routerInstance.js"
export type { Router, RouterCore, RouterNavigationMode } from "./routerInstance.js"
export { RouterProvider, useRouter } from "./routerContext.js"
export type { RouterProviderProps } from "./routerContext.js"
export { Link } from "./link.js"
export type { LinkProps, LinkPrefetch } from "./link.js"
export { useParams } from "./useParams.js"
export type {
  AppRoutePath,
  CreatedRoute,
  HasRouteParams,
  NavigatePath,
  ParamsForPath,
  RouteParams,
  RouteTree,
} from "./routePaths.js"
export {
  createRoute,
  createRouteScope,
  createRouteTree,
  mergeRouteTree,
} from "./createRouteTree.js"
export { RouterView } from "./routerView.js"
import { useRouter } from "./routerContext.js"
import { buildLoaderContext } from "./runPageLoad.js"
import { attachRouterRuntime } from "./routerRuntime.js"
import { staticLoaderSignal } from "./navigationScope.js"
import {
  clearStreamedSsrClientState,
  resetHydratedPageData,
} from "./pageData.js"
import {
  isStaticPageHead,
  isSyncPageHead,
  readPageHeadExport,
  syncDocumentHeadForPage,
} from "./pageHead.js"
import { registerKiruRouter } from "./routerGlobal.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"
import { invalidateLoaderCache } from "./loaderCache.js"
import {
  formatPublicHref,
  formatPublicPathname,
  getI18nLocaleRouting,
  loaderI18nFields,
  loadI18nMessages,
  resolveInvalidLocaleRedirect,
  shouldRejectInvalidLocale,
  splitAppPathname,
  splitAppPathnameDetailed,
  type InternationalizationConfig,
} from "./i18n/index.js"
import {
  createI18nRuntime,
  readHydratedI18n,
} from "./i18nContext.js"
import { addLocale, type I18nLocaleRouting } from "./i18n/localeRouting.js"

export {
  createI18nConfig,
  type InternationalizationConfig,
  type I18nOptions,
} from "./i18n/index.js"
export { useI18n, I18nProvider } from "./i18nContext.js"

function joinPath(base: string, path: string): string {
  if (path.startsWith("#") || path.startsWith("?")) {
    return `${formatPathname(base, undefined)}${path}`
  }
  if (path.startsWith("/")) return path
  if (base.endsWith("/")) return `${base}${path}`
  return `${base}/${path}`
}

function resolveRouterHref(
  logicalPathname: string,
  to: string,
  hrefOpts: { locale?: string | false } | undefined,
  localeRouting: I18nLocaleRouting | undefined,
  activeLocale: string | undefined,
  policy: RouterPathPolicy,
  baseUrl: string
): string {
  const { pathname: pathPart, search, hash } = splitRouterTo(to)
  const relative =
    pathPart === ""
      ? formatPathname(logicalPathname, policy)
      : formatPathname(joinPath(logicalPathname, pathPart), policy)
  let href: string
  if (hrefOpts?.locale === false && localeRouting) {
    href = addBase(relative, baseUrl)
  } else {
    const targetLocale =
      hrefOpts?.locale === false
        ? undefined
        : (hrefOpts?.locale ?? activeLocale)
    if (targetLocale && localeRouting) {
      href = addBase(addLocale(relative, targetLocale, localeRouting), baseUrl)
    } else {
      href = addBase(stripBase(relative, baseUrl), baseUrl)
    }
  }
  return `${href}${search}${hash}`
}

export type { RouterQuery } from "./requestUrl.js"

export type { RouteTreeMatchSegment } from "./navigation.js"

function locationFromMatch(match: RouteMatch | null): RouteLocation | null {
  if (!match) return null
  return { pathname: match.pathname, params: match.params }
}

function snapshotFromParts(
  parts: RouteLocationParts,
  params: Record<string, string>
): RouteLocationSnapshot {
  return {
    pathname: parts.pathname,
    params,
    query: parts.query,
    hash: parts.hash,
  }
}

function pathFromLocation(location: Location, baseUrl: string): string {
  return stripBase(location.pathname, baseUrl)
}

/**
 * Options for {@link createRouter} (CSR / hydrated client).
 *
 * Request context and auth gating use {@link resolveContext} plus scope
 * `contextStrategy` / {@link contextGate}.
 * @see docs/router/route-middleware-and-context.md
 */
export type CreateRouterOptions = {
  /** Route tree from {@link createRouteTree} or a precompiled {@link RouteManifest}. */
  routes: RouteTreeDefinition | RouteManifest
  /** Browser history API (defaults to `window.history`). */
  history?: History
  /** Initial URL (defaults to `window.location`; use in tests or non-browser hosts). */
  location?: Location
  /** Base path and trailing-slash rules for matching, links, and middleware `href`. */
  pathPolicy?: RouterPathPolicy
  /** When true, navigations use the View Transitions API where supported. */
  transition?: boolean
  /**
   * Locale-aware routing ({@link Link}, {@link resolveHref}, message bundles).
   * See {@link createRenderer} `i18n` and `createI18nConfig`.
   */
  i18n?: InternationalizationConfig<readonly string[], unknown>
  /**
   * Loads {@link CustomRequestContext} on the client (session, tenant, etc.).
   * Required for `contextStrategy: "block"` scopes; pairs with
   * {@link RequestContextProvider} / {@link useRequestContext}.
   */
  resolveContext?: (event: ResolveContextEvent) => Promise<CustomRequestContext>
  /**
   * App default when scope `contextStrategy` is `inherit`.
   * `"off"` (default): only explicit scope strategies gate the outlet.
   * `"block"`: treat inherit routes like `block` (await context before leaf).
   */
  contextGate?: ContextGateMode
  /**
   * Outlet UI while a blocked route waits for context (app default; scopes may
   * override via `contextPendingFallback` on `r.scope()`).
   */
  contextPendingFallback?: ContextPendingFallback
  /**
   * When true (default), reuse the last resolved context on navigations that do
   * not await context (`background` / non-block inherit). Set false to refetch on
   * every navigation.
   */
  stickyContext?: boolean
}

export function createRouter({
  routes,
  history = window.history,
  location = window.location,
  pathPolicy,
  transition = false,
  i18n,
  resolveContext: resolveContextOption,
  contextGate: contextGateMode = "off",
  contextPendingFallback,
  stickyContext = true,
}: CreateRouterOptions): Router {
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const resolvedPathPolicy = resolvePathPolicy(pathPolicy)
  const normalizedBaseUrl = resolvedPathPolicy.baseUrl
  const localeRouting = i18n ? getI18nLocaleRouting(i18n) : undefined
  const rawInitialPath = pathFromLocation(location, normalizedBaseUrl)
  const initialSplit = localeRouting
    ? splitAppPathname(rawInitialPath, localeRouting)
    : { locale: null as string | null, pathname: rawInitialPath }
  const hydratedI18n = readHydratedI18n()
  const initialLocale =
    initialSplit.locale ??
    hydratedI18n?.locale ??
    (i18n ? i18n.default : "en")
  const origin =
    (location as Location & { origin?: string }).origin || "http://localhost"
  const pathname = signal(initialSplit.pathname)
  const locale = i18n ? signal(initialLocale) : undefined
  const i18nRuntime = i18n
    ? createI18nRuntime<unknown>({
        initialLocale,
        initialData: hydratedI18n?.data ?? {},
        locales: hydratedI18n?.locales ?? i18n.locales,
        defaultLocale: hydratedI18n?.defaultLocale ?? i18n.default,
      })
    : undefined
  const loaderI18nExtras = () =>
    i18n && locale ? loaderI18nFields(i18n, locale.peek()) : {}
  if (i18n && i18nRuntime && hydratedI18n) {
    i18nRuntime.setLocale(hydratedI18n.locale, hydratedI18n.data)
  }
  const hash = signal(location.hash)
  const query = signal(parseQuery(location.search))
  const path = pathname
  const match = signal(
    matchRoute(manifest, initialSplit.pathname, resolvedPathPolicy)
  )
  const params = signal(match.value?.params ?? {})
  const matches = signal(buildMatchSegments(match.peek()))
  const isNavigating = signal(false)
  const currentNavigation = signal<CurrentNavigation | null>(null)
  const loaderEpoch = signal(0)
  const forceLoaderReload = signal(false)
  const isLoaderPending = signal(false)
  const isLoaderStale = signal(false)
  const outletRenderError = signal<Error | null>(null)
  const validatedQuery = signal<unknown | null>(null)
  const validatedRouteParams = signal<Record<string, unknown> | null>(null)
  const hydratedCtx =
    typeof document !== "undefined" ? readHydratedRequestContext() : {}
  const requestContext = signal<CustomRequestContext>(hydratedCtx)
  const contextState = signal<ContextState>(initialContextState(hydratedCtx))
  const gateOptions: ContextGateOptions = {
    contextGate: contextGateMode,
    hasResolveContext: !!resolveContextOption,
  }
  const contextGate = signal<ContextGateState>(
    resolveContextGateState(
      match.peek(),
      contextState.peek(),
      requestContext.peek(),
      gateOptions
    )
  )

  const toBrowserPath = (logical: string) =>
    localeRouting && locale
      ? formatPublicPathname(logical, locale.peek(), localeRouting, resolvedPathPolicy)
      : logical

  async function validateInitialSearch() {
    const initialMatch = match.peek()
    if (!initialMatch) return
    const check = await validateSearchForMatch(initialMatch, query.peek(), {
      hash: hash.peek(),
    })
    if (check.ok) {
      validatedQuery.value = check.validatedQuery ?? null
      validatedRouteParams.value = check.params
    }
  }
  void validateInitialSearch()

  async function syncInitialDocumentHead() {
    const initial = match.peek()
    if (!initial) return
    if (!canLoadProtectedLeaf(initial, contextGate.peek(), gateOptions)) return
    const pageHead = readPageHeadExport(await initial.route.component())
    if (isStaticPageHead(pageHead) || isSyncPageHead(pageHead)) {
      await syncDocumentHeadForPage(
        initial,
        buildLoaderContext({
          params: initial.params,
          pathname: initial.pathname,
          search: formatRouterSearch(query.peek()),
          hash: hash.peek(),
          query: query.peek(),
          context: requestContext.peek(),
          meta: mergeRouteMeta(initial),
          routeId: initial.route.id,
          signal: navAbortController.current?.signal ?? staticLoaderSignal(),
          ...loaderI18nExtras(),
        })
      )
    }
  }

  if (typeof document !== "undefined") {
    void syncInitialDocumentHead()
    if (resolveContextOption) {
      const initial = match.peek()
      if (initial) {
        void runContextResolve({
          match: initial,
          to: {
            pathname: initial.pathname,
            params: initial.params,
            query: query.peek(),
            hash: hash.peek(),
          },
          from: null,
          resolveContext: resolveContextOption,
          gateOptions,
          contextState,
          requestContext,
          navEpoch: 0,
          getNavEpoch: () => 0,
          stickyContext,
          hadReadyContext: contextState.peek() === "ready",
          eventType: "initial",
        }).then(() => {
          contextGate.value = resolveContextGateState(
            initial,
            contextState.peek(),
            requestContext.peek(),
            gateOptions
          )
        })
      }
    }
  }

  const syncWindowNavigationProbe = () => {
    if (typeof window === "undefined") return
    const nav = currentNavigation.peek()
    const w = window as Window & {
      __KIRU_NAV__?: { isNavigating: boolean; from: string; to: string }
    }
    w.__KIRU_NAV__ = {
      isNavigating: isNavigating.peek(),
      from: formatNavigationSnapshotLabel(nav?.from),
      to: formatNavigationSnapshotLabel(nav?.to),
    }
  }
  isNavigating.subscribe(syncWindowNavigationProbe)
  currentNavigation.subscribe(syncWindowNavigationProbe)
  syncWindowNavigationProbe()

  const afterEachHooks: AfterEachHook[] = []
  const leaveByRoute = new Map<string, NavigationGuard[]>()
  const updateByRoute = new Map<string, NavigationGuard[]>()
  const componentEnterGuards: NavigationGuard[] = []
  const disposeCleanups: (() => void)[] = []

  const getGuardBucket = (map: Map<string, NavigationGuard[]>, id: string) => {
    let list = map.get(id)
    if (!list) {
      list = []
      map.set(id, list)
    }
    return list
  }

  const navToken = { value: 0 }
  const navAbortController: { current: AbortController | null } = {
    current: null,
  }
  const transitionsEnabled = !!transition
  const historyIndex = { value: 0 }
  const scrollStack = {
    value: typeof window !== "undefined" ? readScrollStack() : ([] as ScrollStackState),
  }

  const saveScrollAt = (index: number) => {
    if (typeof window === "undefined") return
    scrollStack.value[index] = [window.scrollX, window.scrollY]
    writeScrollStack(scrollStack.value)
  }

  const currentLocationParts = (): RouteLocationParts => ({
    pathname: pathname.peek(),
    hash: hash.peek(),
    query: query.peek(),
  })

  async function syncDocumentHeadAfterCommit(
    routeMatch: NonNullable<RouteMatch>,
    loc: RouteLocationParts
  ) {
    if (!canLoadProtectedLeaf(routeMatch, contextGate.peek(), gateOptions)) {
      return
    }
    const pageHead = readPageHeadExport(await routeMatch.route.component())
    if (isStaticPageHead(pageHead) || isSyncPageHead(pageHead)) {
      await syncDocumentHeadForPage(
        routeMatch,
        buildLoaderContext({
          params: routeMatch.params,
          pathname: routeMatch.pathname,
          search: formatRouterSearch(loc.query),
          hash: loc.hash,
          query: loc.query,
          context: requestContext.peek(),
          meta: mergeRouteMeta(routeMatch),
          routeId: routeMatch.route.id,
          signal: navAbortController.current?.signal ?? staticLoaderSignal(),
          ...loaderI18nExtras(),
        })
      )
    }
  }

  const commitLocation = (next: RouteLocationParts) => {
    outletRenderError.value = null
    const prevPath = pathname.peek()
    if (next.pathname !== prevPath) {
      resetHydratedPageData()
      clearStreamedSsrClientState()
      if (prevPath) {
        invalidateLoaderCache({ pathname: prevPath })
      }
    }
    pathname.value = next.pathname
    hash.value = next.hash
    query.value = next.query
    const nextMatch = matchRoute(manifest, next.pathname, resolvedPathPolicy)
    match.value = nextMatch
    params.value = nextMatch?.params ?? {}
    matches.value = buildMatchSegments(nextMatch)
    if (typeof document !== "undefined" && nextMatch) {
      void syncDocumentHeadAfterCommit(nextMatch, next)
    }
  }

  const lastNavigationHolder: {
    entry?: {
      to: RouteLocation
      from: RouteLocation | null
      failure?: NavigationFailure
    }
  } = {}

  const navigateInternal = createNavigateInternal(
    {
      manifest,
      resolvedPathPolicy,
      normalizedBaseUrl,
      origin,
      pathname,
      hash,
      query,
      match,
      params,
      matches,
      isNavigating,
      currentNavigation,
      contextGateMode,
      stickyContext,
      resolveContext: resolveContextOption,
      requestContext,
      contextState,
      contextGate,
      afterEachHooks,
      leaveByRoute,
      updateByRoute,
      componentEnterGuards,
      history,
      navToken,
      navAbortController,
      historyIndex,
      scrollStack,
      saveScrollAt,
      commitLocation: (next) => commitLocation(next),
      setValidatedQuery: (data) => {
        validatedQuery.value = data
      },
      setValidatedRouteParams: (data) => {
        validatedRouteParams.value = data
      },
      buildMatchSegments,
      locationFromMatch,
      snapshotFromParts,
      currentLocationParts,
      setLastNavigation: (entry) => {
        lastNavigationHolder.entry = entry
      },
      localeRouting,
      locale,
      onLocaleChange:
        i18n && i18nRuntime
          ? (loc) => {
              i18nRuntime.setLocale(loc, i18nRuntime.data.peek())
              void loadI18nMessages(i18n, loc).then((data) => {
                if (i18nRuntime.locale.peek() === loc) {
                  i18nRuntime.setLocale(loc, data)
                }
              })
            }
          : undefined,
    },
    transitionsEnabled
  )

  if (typeof window !== "undefined" && localeRouting) {
    const initialDetailed = splitAppPathnameDetailed(rawInitialPath, localeRouting)
    if (
      initialDetailed.kind === "invalid-locale" &&
      !shouldRejectInvalidLocale(localeRouting)
    ) {
      const redirectPath = resolveInvalidLocaleRedirect(
        initialDetailed,
        localeRouting,
        resolvedPathPolicy
      )
      void navigateInternal(
        new URL(
          addBase(redirectPath, normalizedBaseUrl) +
            location.search +
            location.hash,
          origin
        ),
        { replace: true, fromPopstate: false }
      )
    }
  }

  if (typeof window !== "undefined") {
    window.history.scrollRestoration = "manual"
    historyIndex.value = ensureHistoryIndex(history)
    const onBeforeUnload = () => {
      saveScrollAt(historyIndex.value)
      window.history.scrollRestoration = "auto"
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    disposeCleanups.push(() =>
      window.removeEventListener("beforeunload", onBeforeUnload)
    )
    const onPopstate = (event: PopStateEvent) => {
      saveScrollAt(historyIndex.value)
      const state = event.state as { index?: number } | null
      if (typeof state?.index === "number") {
        historyIndex.value = state.index
      }
      void navigateInternal(new URL(window.location.href), {
        replace: true,
        fromPopstate: true,
      }).then(() => {
        const offset = scrollStack.value[historyIndex.value]
        if (offset) window.scrollTo(offset[0], offset[1])
      })
    }
    window.addEventListener("popstate", onPopstate)
    disposeCleanups.push(() =>
      window.removeEventListener("popstate", onPopstate)
    )
  }

  const removeArrayEntry = <T,>(array: T[], entry: T) => {
    const i = array.indexOf(entry)
    if (i !== -1) array.splice(i, 1)
  }

  const routerRef: Router = {
    manifest,
    pathname,
    params,
    hash,
    query,
    baseUrl: normalizedBaseUrl,
    path,
    match,
    matches,
    isNavigating,
    currentNavigation,
    loaderEpoch,
    forceLoaderReload,
    isLoaderPending,
    isLoaderStale,
    outletRenderError,
    validatedQuery,
    validatedRouteParams,
    async invalidate(options) {
      const ids = options?.routeIds
      if (ids?.length) {
        const active = match.peek()?.route.id
        if (!active || !ids.includes(active)) return
        invalidateLoaderCache({ routeIds: ids })
      } else {
        invalidateLoaderCache()
      }
      resetHydratedPageData()
      clearStreamedSsrClientState()
      forceLoaderReload.value = true
      loaderEpoch.value += 1
    },
    navigationMode: "history",
    requestContext,
    contextState,
    contextGate,
    contextPendingFallback,
    async refreshContext() {
      if (!resolveContextOption) return
      const m = match.peek()
      if (!m) return
      await runContextResolve({
        match: m,
        to: {
          pathname: m.pathname,
          params: m.params,
          query: query.peek(),
          hash: hash.peek(),
        },
        from: null,
        resolveContext: resolveContextOption,
        gateOptions,
        contextState,
        requestContext,
        navEpoch: navToken.value,
        getNavEpoch: () => navToken.value,
        stickyContext: false,
        hadReadyContext: false,
        eventType: "refresh",
      })
      contextGate.value = resolveContextGateState(
        m,
        contextState.peek(),
        requestContext.peek(),
        gateOptions
      )
      loaderEpoch.value += 1
    },
    navigate(to, replaceOrOptions = false) {
      const options: import("./routePaths.js").RouterNavigateCallOptions =
        typeof replaceOrOptions === "boolean"
          ? { replace: replaceOrOptions }
          : (replaceOrOptions ?? {})
      const { params: routeParams, replace, transition, locale } = options
      const resolvedTo = resolveNavigateTarget(to, routeParams)
      const prevHash = hash.peek()
      const { pathname: pathPart, search, hash: targetHash } =
        splitRouterTo(resolvedTo)
      const logical =
        pathPart === ""
          ? pathname.peek()
          : joinPath(pathname.peek(), pathPart)
      const href =
        locale !== undefined && localeRouting
          ? locale === false
            ? formatPathname(logical, resolvedPathPolicy)
            : formatPublicPathname(
                logical,
                locale,
                localeRouting,
                resolvedPathPolicy
              )
          : toBrowserPath(logical)
      const currentHref = `${origin}${addBase(
        toBrowserPath(pathname.peek()),
        normalizedBaseUrl
      )}`
      const url = new URL(
        addBase(href, normalizedBaseUrl) + search + targetHash,
        currentHref
      )
      return navigateInternal(url, {
        replace: !!replace,
        fromPopstate: false,
        enableTransition: transition,
      }).then((result) => {
        if (result.status !== "committed") return result
        const nextHash = parseResolvedLocation(url, normalizedBaseUrl).hash
        if (prevHash !== nextHash && typeof window !== "undefined") {
          window.dispatchEvent(new HashChangeEvent("hashchange"))
        }
        if (typeof window !== "undefined" && nextHash) {
          const anchor = document.getElementById(nextHash.slice(1))
          if (anchor) {
            anchor.scrollIntoView()
            return result
          }
        }
        if (typeof window !== "undefined" && !replace) {
          window.scrollTo(0, 0)
        }
        return result
      })
    },
    setQuery(nextQuery, options) {
      const queryString = buildQueryString(nextQuery)
      const current = `${origin}${addBase(
        toBrowserPath(pathname.peek()),
        normalizedBaseUrl
      )}`
      const url = new URL(current)
      url.hash = hash.peek()
      url.search = queryString ? `?${queryString}` : ""
      return navigateInternal(url, {
        replace: !!options?.replace,
        fromPopstate: false,
      })
    },
    setHash(nextHash, options) {
      const prevHash = hash.peek()
      const queryString = buildQueryString(query.peek())
      const current = `${origin}${addBase(
        toBrowserPath(pathname.peek()),
        normalizedBaseUrl
      )}`
      const url = new URL(current)
      url.search = queryString ? `?${queryString}` : ""
      if (nextHash === "#") nextHash = ""
      if (nextHash.length && !nextHash.startsWith("#")) {
        nextHash = `#${nextHash}`
      }
      url.hash = nextHash
      return navigateInternal(url, {
        replace: !!options?.replace,
        fromPopstate: false,
      }).then((result) => {
        const normalizedNextHash = parseResolvedLocation(
          url,
          normalizedBaseUrl
        ).hash
        if (prevHash !== normalizedNextHash && typeof window !== "undefined") {
          window.dispatchEvent(new HashChangeEvent("hashchange"))
        }
        return result
      })
    },
    localeRouting,
    locale,
    defaultLocale: i18n?.default,
    resolveHref(to, hrefOpts) {
      const resolved = resolveNavigateTarget(to, hrefOpts?.params)
      return resolveRouterHref(
        pathname.value,
        resolved,
        hrefOpts,
        localeRouting,
        locale ? locale.peek() : undefined,
        resolvedPathPolicy,
        normalizedBaseUrl
      )
    },
    ...(i18n && localeRouting && locale && i18nRuntime
      ? {
          setLocale(nextLocale, opts) {
            if (typeof document !== "undefined") {
              document.cookie = `${i18n.localeCookie}=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`
            }
            locale.value = nextLocale
            i18nRuntime.setLocale(nextLocale, i18nRuntime.data.peek())
            void loadI18nMessages(i18n, nextLocale).then((data) => {
              if (i18nRuntime.locale.peek() === nextLocale) {
                i18nRuntime.setLocale(nextLocale, data)
              }
            })
            const search = formatRouterSearch(query.peek())
            const href = formatPublicHref(
              pathname.peek(),
              nextLocale,
              localeRouting,
              resolvedPathPolicy,
              normalizedBaseUrl,
              search,
              hash.peek()
            )
            const url = new URL(href, origin)
            return navigateInternal(url, {
              replace: !!opts?.replace,
              fromPopstate: false,
            })
          },
        }
      : {}),
    afterEach(hook) {
      afterEachHooks.push(hook)
      return () => removeArrayEntry(afterEachHooks, hook)
    },
    back() {
      history.back()
    },
    forward() {
      history.forward()
    },
    go(delta) {
      history.go(delta)
    },
    dispose() {
      for (const fn of disposeCleanups) fn()
      disposeCleanups.length = 0
    },
  }

  attachRouterRuntime(routerRef, {
    gateOptions,
    getNavGeneration: () => navToken.value,
    getNavSignal: () =>
      navAbortController.current?.signal ?? staticLoaderSignal(),
    ...(i18n && i18nRuntime
      ? {
          i18n: {
            config: i18n,
            runtime: i18nRuntime,
            value: i18nRuntime.value,
          },
        }
      : {}),
    registerComponentGuard(kind, guard, routeId = "_") {
      if (kind === "leave") {
        const list = getGuardBucket(leaveByRoute, routeId)
        list.push(guard)
        return () => removeArrayEntry(list, guard)
      }
      if (kind === "update") {
        const list = getGuardBucket(updateByRoute, routeId)
        list.push(guard)
        return () => removeArrayEntry(list, guard)
      }
      componentEnterGuards.push(guard)
      return () => removeArrayEntry(componentEnterGuards, guard)
    },
    getLastNavigation: () => lastNavigationHolder.entry,
    setLastNavigation: (entry) => {
      lastNavigationHolder.entry = entry
    },
  })

  registerKiruRouter(routerRef)
  return routerRef
}

export function createStaticRouter({
  manifest,
  pathname,
  hash = "",
  query = {},
  pathPolicy,
  localeRouting,
  locale,
}: {
  manifest: RouteManifest
  pathname: string
  hash?: string
  query?: RouterQuery
  pathPolicy?: RouterPathPolicy
  localeRouting?: I18nLocaleRouting
  locale?: string
}): Router {
  const resolvedPathPolicy = resolvePathPolicy(pathPolicy)
  const normalizedBaseUrl = resolvedPathPolicy.baseUrl
  const path = signal(pathname)
  const params = signal<Record<string, string>>({})
  const hashSignal = signal(hash)
  const querySignal = signal(query)
  const match = signal(matchRoute(manifest, pathname, resolvedPathPolicy))
  params.value = match.value?.params ?? {}
  const matches = signal(buildMatchSegments(match.peek()))
  const isNavigating = signal(false)
  const currentNavigation = signal<CurrentNavigation | null>(null)
  const emptyUnsub = () => {}
  const committed = (): Promise<NavigationResult> =>
    Promise.resolve({ status: "committed" })

  const routerRef: Router = {
    manifest,
    pathname: path,
    params,
    hash: hashSignal,
    query: querySignal,
    baseUrl: resolvedPathPolicy.baseUrl,
    path,
    match,
    matches,
    isNavigating,
    currentNavigation,
    loaderEpoch: signal(0),
    forceLoaderReload: signal(false),
    isLoaderPending: signal(false),
    isLoaderStale: signal(false),
    outletRenderError: signal<Error | null>(null),
    validatedQuery: signal(null),
    validatedRouteParams: signal(null),
    async invalidate() {},
    navigationMode: "static",
    navigate() {
      return committed()
    },
    setQuery() {
      return committed()
    },
    setHash() {
      return committed()
    },
    resolveHref(to, hrefOpts) {
      return resolveRouterHref(
        path.value,
        to,
        hrefOpts,
        localeRouting,
        locale,
        resolvedPathPolicy,
        normalizedBaseUrl
      )
    },
    requestContext: signal({}),
    contextState: signal<ContextState>("idle"),
    contextGate: signal<ContextGateState>(idleContextGate()),
    async refreshContext() {},
    afterEach() {
      return emptyUnsub
    },
    back() {},
    forward() {},
    go() {},
    dispose() {},
  }
  attachRouterRuntime(routerRef, {
    gateOptions: { contextGate: "off", hasResolveContext: false },
    getNavGeneration: () => 0,
    getNavSignal: () => staticLoaderSignal(),
    registerComponentGuard() {
      return emptyUnsub
    },
    getLastNavigation: () => undefined,
    setLastNavigation: () => {},
  })
  return routerRef
}

/** Active route match segments (scopes + leaf), for breadcrumbs and `meta`. */
export function useMatches(): () => RouteTreeMatchSegment[] {
  const router = useRouter()
  return () => router.matches.value
}

/** Validated query when the route `load` defines `validation.query`. */
export function useSearchParams<T = Record<string, unknown>>(): Kiru.Signal<
  T | null
> {
  const router = useRouter()
  return router.validatedQuery as Kiru.Signal<T | null>
}

