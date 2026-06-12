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
  parseQueryBounded,
  resolveRequestLimits,
  type KiruRequestLimits,
} from "./requestLimits.js"
import { splitRouterTo, type RouterQuery } from "./requestUrl.js"
import type {
  AfterEachHook,
  CurrentNavigation,
  CustomRequestContext,
  NavigationFailure,
  NavigationGuard,
  NavigationResult,
  RouteInterceptState,
  RouteLocation,
  RouteLocationSnapshot,
  RouteManifest,
  RouteMatch,
  RouteTreeDefinition,
} from "./types.js"
import { readHydratedRequestContext } from "./requestContext.js"
import { mergeRouteMeta } from "./routeMeta.js"
import {
  buildMatchSegments,
  buildQueryString,
  createNavigateInternal,
  formatRouterSearch,
  ensureHistoryIndex,
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
export type {
  Router,
  RouterCore,
  RouterNavigationMode,
} from "./routerInstance.js"
export { RouterProvider, useRouter } from "./routerContext.js"
export type { RouterProviderProps } from "./routerContext.js"
export { Link } from "./link.js"
export type { LinkProps, LinkPrefetch } from "./link.js"
export { useParams } from "./useParams.js"
export type {
  AppRoutePath,
  CreatedRoute,
  HasRouteParams,
  InterceptLoadContext,
  InterceptLoadResult,
  InterceptRenderContext,
  InterceptorHandle,
  InterceptorOptions,
  InterceptorRenderFn,
  NavigatePath,
  RouteInterceptorDefinition,
  RegisteredRoutePath,
  ParamsForPath,
  RouteParams,
  RouteTree,
} from "./routePaths.js"
export {
  createRoute,
  createRouteScope,
  createRouteTree,
} from "./createRouteTree.js"
export { RouterView } from "./routerView.js"
import { useRouter } from "./routerContext.js"
import { buildLoaderContext } from "./runPageLoad.js"
import { setRouterInstanceRuntime } from "./routerRuntime.js"
import { staticLoaderSignal } from "./navigationScope.js"
import {
  clearStreamedSsrClientState,
  resetHydratedPageData,
} from "./pageData.js"
import {
  createDynamicHeadContext,
  isStaticPageHead,
  pageHeadResolveIsAsync,
  readPageHeadExport,
  syncDocumentHeadForPage,
} from "./pageHead.js"
import { releaseActiveRouter } from "./routerGlobal.js"
import {
  registerRouteInterceptor,
  buildInterceptorPrefetchKey,
  clearInterceptorPrefetchForRegistration,
  consumePrefetchedInterceptorData,
  applyInterceptLoadResult,
  runInterceptorLoad,
  syncAllInterceptorHandlesActive,
  registrationMatchesFrom,
  findRegistrationForHistoryIntercept,
  backgroundMatchFromHistoryIntercept,
  type InterceptorRegistration,
  type KiruHistoryInterceptState,
} from "./routeInterceptors.js"
export { defineInterceptors } from "./defineInterceptors.js"
import { ensureRouteAnnouncerInDocument } from "./navigationAnnouncer.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"
import { invalidateLoaderCache } from "./loaderCache.js"
import { clearAllQueryCache } from "../remote/queryCache.js"
import {
  formatPublicHref,
  formatPublicPathname,
  getI18nLocaleRouting,
  type I18nLocaleRouting,
  loaderI18nFields,
  loadI18nMessages,
  resolveInvalidLocaleRedirect,
  shouldRejectInvalidLocale,
  splitAppPathname,
  splitAppPathnameDetailed,
  type InternationalizationConfig,
} from "./i18n/index.js"
import { parseAppLocation } from "./i18n/routing.js"
import { createI18nRuntime, readHydratedI18n } from "./i18nContext.js"
import { logOutletDebug } from "./outletDebug.js"
import { canEndClientNavigation } from "./outletNavigation.js"

export {
  createI18nConfig,
  type InternationalizationConfig,
  type CreateI18nConfigInput,
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
  baseUrl: string,
  host?: string | null,
  protocol?: string
): string {
  const { pathname: pathPart, search, hash } = splitRouterTo(to)
  const relative =
    pathPart === ""
      ? formatPathname(logicalPathname, policy)
      : formatPathname(joinPath(logicalPathname, pathPart), policy)
  if (hrefOpts?.locale === false && localeRouting) {
    return `${addBase(relative, baseUrl)}${search}${hash}`
  }
  const targetLocale =
    hrefOpts?.locale === false ? undefined : hrefOpts?.locale ?? activeLocale
  if (targetLocale && localeRouting) {
    return formatPublicHref(
      relative,
      targetLocale,
      localeRouting,
      policy,
      baseUrl,
      search,
      hash,
      { host, protocol }
    )
  }
  return `${addBase(stripBase(relative, baseUrl), baseUrl)}${search}${hash}`
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
 * Request context on the client comes from SSR hydration (`k-request-context`)
 * when present; pure CSR defaults to `{}`.
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
  /** When false, omit `<kiru-route-announcer>` and skip route title announcements (default true). */
  navigationAnnouncer?: boolean
  /** Ingress bounds for client navigations and query parsing (merged with defaults). */
  requestLimits?: Partial<KiruRequestLimits>
}

export function createRouter({
  routes,
  history = window.history,
  location = window.location,
  pathPolicy,
  transition = false,
  i18n,
  navigationAnnouncer = true,
  requestLimits: requestLimitsPartial,
}: CreateRouterOptions): Router {
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const requestLimits = resolveRequestLimits(requestLimitsPartial)
  const resolvedPathPolicy = resolvePathPolicy(pathPolicy)
  const normalizedBaseUrl = resolvedPathPolicy.baseUrl
  const localeRouting = i18n ? getI18nLocaleRouting(i18n) : undefined
  const rawInitialPath = pathFromLocation(location, normalizedBaseUrl)
  const requestHost = location.host
  const initialSplit = localeRouting
    ? splitAppPathname(rawInitialPath, localeRouting, { host: requestHost })
    : { locale: null as string | null, pathname: rawInitialPath }
  const hydratedI18n = readHydratedI18n()
  const initialLocale =
    initialSplit.locale ??
    hydratedI18n?.locale ??
    (i18n ? i18n.defaultLocale : "en")
  const origin = location.origin || "http://localhost"
  const pathname = signal(initialSplit.pathname)
  const locale = i18n ? signal(initialLocale) : undefined
  const i18nRuntime = i18n
    ? createI18nRuntime<unknown>({
        initialLocale,
        initialData: hydratedI18n?.data ?? {},
        locales: hydratedI18n?.locales ?? i18n.locales,
        defaultLocale: hydratedI18n?.defaultLocale ?? i18n.defaultLocale,
      })
    : undefined
  const loaderI18nExtras = () =>
    i18n && locale ? loaderI18nFields(i18n, locale.peek()) : {}
  if (i18n && i18nRuntime && hydratedI18n) {
    i18nRuntime.setLocale(hydratedI18n.locale, hydratedI18n.data)
  }
  const hash = signal(location.hash)
  let initialQuery: RouterQuery = {}
  try {
    initialQuery = parseQueryBounded(location.search, requestLimits)
  } catch {
    initialQuery = {}
  }
  const query = signal(initialQuery)
  const path = pathname
  const match = signal(
    matchRoute(
      manifest,
      initialSplit.pathname,
      resolvedPathPolicy,
      requestLimits
    )
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
  const interceptState = signal<RouteInterceptState | null>(null)
  const interceptorRegistrations: InterceptorRegistration[] = []
  const scopeInterceptorOutlets: Record<string, Kiru.Component> = {}
  const hydratedCtx =
    typeof document !== "undefined" ? readHydratedRequestContext() : {}
  const requestContext = signal<CustomRequestContext>(hydratedCtx)

  const toBrowserPath = (logical: string) =>
    localeRouting && locale
      ? formatPublicPathname(
          logical,
          locale.peek(),
          localeRouting,
          resolvedPathPolicy,
          requestHost
        )
      : logical

  async function runInitialClientSetup(match: RouteMatch) {
    const pageModPromise = match.route.component()
    const [, pageMod] = await Promise.all([
      (async () => {
        const check = await validateSearchForMatch(match, query.peek(), {
          hash: hash.peek(),
        })
        if (check.ok) {
          validatedQuery.value = check.validatedQuery ?? null
          validatedRouteParams.value = check.params
        }
      })(),
      pageModPromise,
    ])
    const pageHead = readPageHeadExport(pageMod)
    const loaderCtx = buildLoaderContext({
      params: match.params,
      pathname: match.pathname,
      search: formatRouterSearch(query.peek()),
      hash: hash.peek(),
      query: query.peek(),
      context: requestContext.peek(),
      meta: mergeRouteMeta(match),
      routeId: match.route.id,
      signal: navAbortController.current?.signal ?? staticLoaderSignal(),
      ...loaderI18nExtras(),
    })
    const headCtx = createDynamicHeadContext(loaderCtx, pageMod)
    if (
      isStaticPageHead(pageHead) ||
      (!!pageHead && !pageHeadResolveIsAsync(pageHead, headCtx))
    ) {
      await syncDocumentHeadForPage(match, loaderCtx, undefined, pageMod)
    }
  }

  if (typeof document !== "undefined") {
    const initialMatch = match.peek()
    if (initialMatch) {
      void runInitialClientSetup(initialMatch)
    }
  }

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
    value:
      typeof window !== "undefined"
        ? readScrollStack()
        : ([] as ScrollStackState),
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
    const pageMod = await routeMatch.route.component()
    const pageHead = readPageHeadExport(pageMod)
    const loaderCtx = buildLoaderContext({
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
    const headCtx = createDynamicHeadContext(loaderCtx, pageMod)
    if (
      isStaticPageHead(pageHead) ||
      (!!pageHead && !pageHeadResolveIsAsync(pageHead, headCtx))
    ) {
      await syncDocumentHeadForPage(routeMatch, loaderCtx, undefined, pageMod)
    }
  }

  const buildTargetLocation = (targetMatch: RouteMatch): RouteLocation => ({
    pathname: targetMatch.pathname,
    params: targetMatch.params,
  })

  const syncInterceptorHandles = () => {
    syncAllInterceptorHandlesActive(
      interceptorRegistrations,
      interceptState.peek()
    )
  }

  const dismissIntercept = (options?: { skipHistoryBack?: boolean }) => {
    const state = interceptState.value
    if (!state) return
    clearInterceptorPrefetchForRegistration(state.registrationId)
    syncInterceptorHandles()
    interceptState.value = null
    const bg = state.backgroundMatch
    pathname.value = bg.pathname
    params.value = bg.params
    match.value = bg
    matches.value = buildMatchSegments(bg)
    isNavigating.value = false
    currentNavigation.value = null
    if (!options?.skipHistoryBack && typeof window !== "undefined") {
      history.back()
    }
  }

  const commitInterceptLocation = async (input: {
    target: RouteLocationParts
    targetMatch: RouteMatch
    backgroundMatch: RouteMatch
    registration: InterceptorRegistration
    signal: AbortSignal
  }) => {
    outletRenderError.value = null
    pathname.value = input.target.pathname
    hash.value = input.target.hash
    query.value = input.target.query
    params.value = input.targetMatch.params
    match.value = input.backgroundMatch
    matches.value = buildMatchSegments(input.backgroundMatch)
    const nextState: RouteInterceptState = {
      registrationId: input.registration.id,
      backgroundMatch: input.backgroundMatch,
      targetMatch: input.targetMatch,
      data: null,
      error: null,
    }
    syncAllInterceptorHandlesActive(interceptorRegistrations, nextState)
    interceptState.value = nextState
    const prefetchKey = buildInterceptorPrefetchKey(
      input.registration.id,
      input.targetMatch
    )
    const cached = consumePrefetchedInterceptorData(prefetchKey)
    const loadDeps = {
      getRequestContext: () => requestContext.peek(),
      buildTargetLocation,
    }
    const result = await runInterceptorLoad(
      loadDeps,
      input.registration,
      nextState,
      input.signal,
      cached.kind === "hit"
        ? { fromPrefetch: true, prefetchedData: cached.data }
        : undefined
    )
    if (input.signal.aborted) return
    if (interceptState.peek()?.registrationId === input.registration.id) {
      const loadedState = applyInterceptLoadResult(nextState, result)
      syncAllInterceptorHandlesActive(interceptorRegistrations, loadedState)
      interceptState.value = loadedState
      if (
        canEndClientNavigation({
          pathname,
          match,
          currentNavigation,
          isNavigating,
          interceptState,
        })
      ) {
        isNavigating.value = false
        currentNavigation.value = null
      }
    }
  }

  const commitLocation = (next: RouteLocationParts) => {
    outletRenderError.value = null
    syncInterceptorHandles()
    interceptState.value = null
    const prevPath = pathname.peek()
    const prevMatch = match.peek()
    const nextMatch = matchRoute(
      manifest,
      next.pathname,
      resolvedPathPolicy,
      requestLimits
    )
    const routeChanged = prevMatch?.route.id !== nextMatch?.route.id
    if (next.pathname !== prevPath || routeChanged) {
      resetHydratedPageData()
      clearStreamedSsrClientState()
      if (prevPath) {
        invalidateLoaderCache({ pathname: prevPath })
      }
    }
    pathname.value = next.pathname
    hash.value = next.hash
    query.value = next.query
    match.value = nextMatch
    params.value = nextMatch?.params ?? {}
    matches.value = buildMatchSegments(nextMatch)
    if (routeChanged) {
      forceLoaderReload.value = true
    }
    logOutletDebug("nav:commitLocation", {
      fromPath: prevPath,
      toPath: next.pathname,
      fromRouteId: prevMatch?.route.id ?? null,
      toRouteId: nextMatch?.route.id ?? null,
      navGen: navToken.value,
    })
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
      requestContext,
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
      setOutletRenderError: (err) => {
        outletRenderError.value = err
      },
      interceptState,
      interceptorRegistrations,
      commitInterceptLocation,
      dismissIntercept,
      requestLimits,
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
    const initialDetailed = splitAppPathnameDetailed(
      rawInitialPath,
      localeRouting,
      {
        host: requestHost,
        protocol: location.protocol,
        baseUrl: normalizedBaseUrl,
      }
    )
    if (initialDetailed.kind === "wrong-domain") {
      void navigateInternal(new URL(initialDetailed.location), {
        replace: true,
        fromPopstate: false,
      })
    } else if (
      initialDetailed.kind === "invalid-locale" &&
      !shouldRejectInvalidLocale(localeRouting)
    ) {
      const redirectPath = resolveInvalidLocaleRedirect(
        initialDetailed,
        localeRouting,
        resolvedPathPolicy,
        {
          host: requestHost,
          protocol: location.protocol,
          baseUrl: normalizedBaseUrl,
        }
      )
      const target = redirectPath.startsWith("http")
        ? redirectPath
        : addBase(redirectPath, normalizedBaseUrl) +
          location.search +
          location.hash
      void navigateInternal(new URL(target, origin), {
        replace: true,
        fromPopstate: false,
      })
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
      const state = event.state as {
        index?: number
        kiruIntercept?: KiruHistoryInterceptState
      } | null
      if (typeof state?.index === "number") {
        historyIndex.value = state.index
      }
      const href = window.location.href
      const resolved = localeRouting
        ? parseAppLocation(
            new URL(href),
            normalizedBaseUrl,
            localeRouting,
            resolvedPathPolicy,
            requestLimits
          )
        : parseResolvedLocation(new URL(href), normalizedBaseUrl, requestLimits)
      const targetPath = resolved.pathname
      const activeIntercept = interceptState.peek()

      if (activeIntercept) {
        const bgPath = activeIntercept.backgroundMatch.pathname
        if (targetPath === bgPath) {
          syncInterceptorHandles()
          interceptState.value = null
          pathname.value = resolved.pathname
          hash.value = resolved.hash
          query.value = resolved.query
          params.value = activeIntercept.backgroundMatch.params
          match.value = activeIntercept.backgroundMatch
          matches.value = buildMatchSegments(activeIntercept.backgroundMatch)
          isNavigating.value = false
          currentNavigation.value = null
          const offset = scrollStack.value[historyIndex.value]
          if (offset) window.scrollTo(offset[0], offset[1])
          return
        }
      }

      if (
        !activeIntercept &&
        !state?.kiruIntercept &&
        targetPath === pathname.peek() &&
        resolved.hash === hash.peek() &&
        formatRouterSearch(resolved.query) === formatRouterSearch(query.peek())
      ) {
        const toMatch = matchRoute(manifest, targetPath, resolvedPathPolicy)
        const currentMatch = match.peek()
        if (
          toMatch &&
          currentMatch &&
          toMatch.route.id === currentMatch.route.id &&
          JSON.stringify(toMatch.params) === JSON.stringify(currentMatch.params)
        ) {
          isNavigating.value = false
          currentNavigation.value = null
          return
        }
      }

      if (state?.kiruIntercept) {
        const toMatch = matchRoute(manifest, targetPath, resolvedPathPolicy)
        if (toMatch) {
          const reg = findRegistrationForHistoryIntercept(
            state.kiruIntercept,
            interceptorRegistrations,
            manifest,
            toMatch,
            resolvedPathPolicy
          )
          const bgMatch = backgroundMatchFromHistoryIntercept(
            manifest,
            state.kiruIntercept,
            resolvedPathPolicy
          )
          if (reg && bgMatch && registrationMatchesFrom(reg, bgMatch)) {
            void commitInterceptLocation({
              target: resolved,
              targetMatch: toMatch,
              backgroundMatch: bgMatch,
              registration: reg,
              signal:
                navAbortController.current?.signal ?? staticLoaderSignal(),
            }).then(() => {
              isNavigating.value = false
              currentNavigation.value = null
              const offset = scrollStack.value[historyIndex.value]
              if (offset) window.scrollTo(offset[0], offset[1])
            })
            return
          }
        }
      }

      void navigateInternal(new URL(href), {
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

  const removeArrayEntry = <T>(array: T[], entry: T) => {
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
    navigationAnnouncer,
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
    interceptState,
    async invalidate(options) {
      const ids = options?.routeIds
      if (ids?.length) {
        const active = match.peek()?.route.id
        if (!active || !ids.includes(active)) return
        invalidateLoaderCache({ routeIds: ids })
      } else {
        invalidateLoaderCache()
        clearAllQueryCache()
      }
      resetHydratedPageData()
      clearStreamedSsrClientState()
      forceLoaderReload.value = true
      loaderEpoch.value += 1
    },
    navigationMode: "history",
    requestContext,
    navigate(to, replaceOrOptions = false) {
      const options: import("./routePaths.js").RouterNavigateCallOptions =
        typeof replaceOrOptions === "boolean"
          ? { replace: replaceOrOptions }
          : replaceOrOptions ?? {}
      const {
        params: routeParams,
        replace,
        transition,
        locale,
        intercept,
      } = options
      const resolvedTo = resolveNavigateTarget(to, routeParams)
      const prevHash = hash.peek()
      const {
        pathname: pathPart,
        search,
        hash: targetHash,
      } = splitRouterTo(resolvedTo)
      const logical =
        pathPart === "" ? pathname.peek() : joinPath(pathname.peek(), pathPart)
      let url: URL
      if (locale !== undefined && localeRouting && locale !== false) {
        const fullHref = formatPublicHref(
          logical,
          locale,
          localeRouting,
          resolvedPathPolicy,
          normalizedBaseUrl,
          search,
          targetHash,
          { host: requestHost, protocol: location.protocol }
        )
        url = new URL(
          fullHref.startsWith("http")
            ? fullHref
            : `${origin}${addBase(fullHref, normalizedBaseUrl)}`
        )
      } else {
        const href =
          locale === false && localeRouting
            ? formatPathname(logical, resolvedPathPolicy)
            : toBrowserPath(logical)
        const currentHref = `${origin}${addBase(
          toBrowserPath(pathname.peek()),
          normalizedBaseUrl
        )}`
        url = new URL(
          addBase(href, normalizedBaseUrl) + search + targetHash,
          currentHref
        )
      }
      return navigateInternal(url, {
        replace: !!replace,
        fromPopstate: false,
        enableTransition: transition,
        intercept,
      }).then((result) => {
        if (result.status !== "committed" && result.status !== "intercepted") {
          return result
        }
        const nextHash = parseResolvedLocation(
          url,
          normalizedBaseUrl,
          requestLimits
        ).hash
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
        if (
          typeof window !== "undefined" &&
          !replace &&
          result.status === "committed"
        ) {
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
          normalizedBaseUrl,
          requestLimits
        ).hash
        if (prevHash !== normalizedNextHash && typeof window !== "undefined") {
          window.dispatchEvent(new HashChangeEvent("hashchange"))
        }
        return result
      })
    },
    localeRouting,
    locale,
    defaultLocale: i18n?.defaultLocale,
    resolveHref(to, hrefOpts) {
      const resolved = resolveNavigateTarget(to, hrefOpts?.params)
      return resolveRouterHref(
        pathname.value,
        resolved,
        hrefOpts,
        localeRouting,
        locale ? locale.peek() : undefined,
        resolvedPathPolicy,
        normalizedBaseUrl,
        requestHost,
        location.protocol
      )
    },
    ...(i18n && localeRouting && locale && i18nRuntime
      ? {
          setLocale(nextLocale, opts) {
            if (typeof document !== "undefined") {
              document.cookie = `${i18n.localeCookie}=${encodeURIComponent(
                nextLocale
              )}; path=/; max-age=31536000; samesite=lax`
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
              hash.peek(),
              { host: requestHost, protocol: location.protocol }
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
      releaseActiveRouter(routerRef)
    },
  }

  setRouterInstanceRuntime(routerRef, {
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
    getRouteInterceptorRegistrations: () => interceptorRegistrations,
    getScopeInterceptorOutlets: () => scopeInterceptorOutlets,
    buildTargetLocation,
    dismissRouteIntercept: dismissIntercept,
    registerRouteInterceptor(target, options, owner, signals) {
      const resolvedOwner =
        owner ??
        ({ kind: "route", routeId: match.peek()?.route.id ?? "_" } as const)
      return registerRouteInterceptor(
        {
          manifest,
          registrations: interceptorRegistrations,
          interceptState,
          getBackgroundMatch: () => match.peek(),
          getNavSignal: () =>
            navAbortController.current?.signal ?? staticLoaderSignal(),
          getRequestContext: () => requestContext.peek(),
          dismissIntercept,
          buildTargetLocation,
          scopeInterceptorOutlets,
        },
        target,
        options,
        resolvedOwner,
        signals
      )
    },
  })

  ensureRouteAnnouncerInDocument(navigationAnnouncer)
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
    navigationAnnouncer: true,
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
    interceptState: signal(null),
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
    afterEach() {
      return emptyUnsub
    },
    back() {},
    forward() {},
    go() {},
    dispose() {},
  }
  setRouterInstanceRuntime(routerRef, {
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
export function useSearchParams<
  T = Record<string, unknown>
>(): Kiru.Signal<T | null> {
  const router = useRouter()
  return router.validatedQuery as Kiru.Signal<T | null>
}
