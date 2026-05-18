import { createContext, useContext } from "../context.js"
import { signal } from "../signals/base.js"
import { resource } from "../resource.js"
import { matchRoute } from "./manifest.js"
import {
  addBase,
  formatPathname,
  resolvePathPolicy,
  stripBase,
  type RouterPathPolicy,
} from "./pathPolicy.js"
import { parseQuery, type RouterQuery } from "./requestUrl.js"
import { createElement } from "../element.js"
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
  RouteTreeDefinition,
} from "./types.js"
import {
  buildQueryString,
  createNavigateInternal,
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
import { setup } from "../hooks/index.js"
import { onMount } from "../hooks/onMount.js"
import {
  buildRoutedSubtree,
  loadNotFoundRouteTree,
  loadRouteTree,
  type LeafRouteProps,
} from "./routeTree.js"
import type { KiruLoader, PageProps } from "./loaders.js"
import { buildLoaderContext } from "./runPageLoad.js"
import { prepareRouteForNavigation } from "./prepareRoute.js"
import {
  clearStreamedSsrClientState,
  resetHydratedPageData,
} from "./pageData.js"
import { isStaticPageHead, readPageHeadExport, syncDocumentHeadForPage } from "./pageHead.js"
import type { CustomRequestContext } from "./types.js"
import { warnRouterViewWithoutSsrBootstrap } from "./devWarnings.js"
import { registerKiruRouter } from "./routerGlobal.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"
import { invalidateLoaderCache } from "./loaderCache.js"
import {
  createI18nConfig,
  formatPublicHref,
  formatPublicPathname,
  i18nToSiteLocales,
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
  type I18nContextValue,
} from "./i18nContext.js"
import { addLocale, type SiteLocales } from "./localePolicy.js"

export {
  createI18nConfig,
  type InternationalizationConfig,
  type I18nOptions,
} from "./i18n/index.js"
export { useI18n, useOptionalI18n, I18nProvider } from "./i18nContext.js"

function joinPath(base: string, path: string): string {
  if (path.startsWith("/")) return path
  if (base.endsWith("/")) return `${base}${path}`
  return `${base}/${path}`
}

function resolveRouterHref(
  logicalPathname: string,
  to: string,
  hrefOpts: { locale?: string | false } | undefined,
  siteLocales: SiteLocales | undefined,
  activeLocale: string | undefined,
  policy: RouterPathPolicy,
  baseUrl: string
): string {
  const relative = formatPathname(joinPath(logicalPathname, to), policy)
  if (hrefOpts?.locale === false && siteLocales) {
    return addBase(relative, baseUrl)
  }
  const targetLocale =
    hrefOpts?.locale === false
      ? undefined
      : (hrefOpts?.locale ?? activeLocale)
  if (targetLocale && siteLocales) {
    return addBase(addLocale(relative, targetLocale, siteLocales), baseUrl)
  }
  return addBase(stripBase(relative, baseUrl), baseUrl)
}

export type RouterNavigationMode = "history" | "static"
export type { RouterQuery } from "./requestUrl.js"

export type { RouteTreeMatchSegment } from "./navigation.js"

function buildMatchSegments(match: RouteMatch | null): RouteTreeMatchSegment[] {
  if (!match) return []
  const out: RouteTreeMatchSegment[] = []
  for (const scope of match.route.scopes) {
    out.push({
      id: scope.id,
      kind: "scope",
      meta: scope.meta ?? {},
    })
  }
  out.push({
    id: match.route.id,
    kind: "route",
    meta: match.route.meta ?? {},
  })
  return out
}

export interface Router {
  manifest: RouteManifest
  pathname: Kiru.Signal<string>
  params: Kiru.Signal<Record<string, string>>
  hash: Kiru.Signal<string>
  query: Kiru.Signal<RouterQuery>
  baseUrl: string
  path: Kiru.Signal<string>
  match: Kiru.Signal<RouteMatch | null>
  /** Active scope chain + leaf route (for breadcrumbs, meta). */
  matches: Kiru.Signal<RouteTreeMatchSegment[]>
  navigate: (
    to: string,
    replaceOrOptions?:
      | boolean
      | { replace?: boolean; transition?: boolean; locale?: string | false }
  ) => Promise<NavigationResult>
  setQuery: (
    query: RouterQuery,
    options?: { replace?: boolean }
  ) => Promise<NavigationResult>
  setHash: (
    hash: string,
    options?: { replace?: boolean }
  ) => Promise<NavigationResult>
  resolveHref: (to: string, options?: { locale?: string | false }) => string
  /** Switch locale on the current logical route (preserves query and hash). */
  setLocale?: (
    nextLocale: string,
    options?: { replace?: boolean }
  ) => Promise<NavigationResult>
  /** Active locale when `createRouter({ i18n })` is used. */
  locale?: Kiru.Signal<string>
  defaultLocale?: string
  /** When set, {@link Link} `locale` prop and {@link resolveHref} can prefix paths. */
  locales?: SiteLocales
  /** @internal Hydrated + runtime i18n state. */
  __i18n?: {
    runtime: ReturnType<typeof createI18nRuntime<unknown>>
    config: InternationalizationConfig<readonly string[], unknown>
    value: () => I18nContextValue
  }
  /** `"history"` = SPA navigation; `"static"` = prerender/SSR (native &lt;a&gt; only). */
  navigationMode: RouterNavigationMode
  beforeEach: (guard: NavigationGuard) => () => void
  beforeResolve: (guard: NavigationGuard) => () => void
  afterEach: (hook: AfterEachHook) => () => void
  isNavigating: Kiru.Signal<boolean>
  currentNavigation: Kiru.Signal<CurrentNavigation | null>
  /** Bumps when {@link invalidate} requests a loader refetch. */
  loaderEpoch: Kiru.Signal<number>
  /** @internal Skip hydrated page data on next outlet load. */
  forceLoaderReload: Kiru.Signal<boolean>
  /** True while the route outlet is reloading loader data. */
  isLoaderPending: Kiru.Signal<boolean>
  /** True when showing loader data past `staleTime` (before refetch completes). */
  isLoaderStale: Kiru.Signal<boolean>
  /** Validated query for the active route (`load.validation.query`). */
  validatedQuery: Kiru.Signal<unknown | null>
  /** Route params passed to loaders (validated when `load.validation.params` is set). */
  validatedRouteParams: Kiru.Signal<Record<string, unknown> | null>
  /**
   * Refetch loaders for the active route (bumps `loaderEpoch`, clears hydrated page data).
   * When `routeIds` is set, no-op unless the active route id is listed.
   * Remote actions can trigger invalidation via `x-kiru-invalidate` (see {@link applyInvalidateResponseHeader}).
   */
  invalidate: (options?: {
    current?: boolean
    routeIds?: string[]
  }) => Promise<void>
  back: () => void
  forward: () => void
  go: (delta: number) => void
  dispose: () => void

  /** @internal */
  __registerComponentGuard?: (
    kind: "leave" | "update" | "enter",
    guard: NavigationGuard,
    routeId?: string
  ) => () => void
  /** @internal */
  __lastNavigation?: {
    to: RouteLocation
    from: RouteLocation | null
    failure?: NavigationFailure
  }
}

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

export function createRouter({
  routes,
  history = window.history,
  location = window.location,
  pathPolicy,
  transition = false,
  locales: localesOption,
  i18n,
}: {
  routes: RouteTreeDefinition | RouteManifest
  history?: History
  location?: Location
  pathPolicy?: RouterPathPolicy
  transition?: boolean
  /** Locale prefixes for {@link Link} `locale` prop. @see docs/router/tier-3-wave-1.md#i18n */
  locales?: SiteLocales
  /** Type-safe i18n config from {@link createI18nConfig}. */
  i18n?: InternationalizationConfig<readonly string[], unknown>
}): Router {
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const resolvedPathPolicy = resolvePathPolicy(pathPolicy)
  const normalizedBaseUrl = resolvedPathPolicy.baseUrl
  const siteLocales = i18n
    ? i18nToSiteLocales(i18n)
    : localesOption
  const rawInitialPath = pathFromLocation(location, normalizedBaseUrl)
  const initialSplit = siteLocales
    ? splitAppPathname(rawInitialPath, siteLocales)
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
  if (i18n && i18nRuntime && !hydratedI18n) {
    void loadI18nMessages(i18n, initialLocale).then((data) => {
      i18nRuntime.setLocale(initialLocale, data)
    })
  } else if (i18n && i18nRuntime && hydratedI18n) {
    i18nRuntime.setLocale(hydratedI18n.locale, hydratedI18n.data)
  }
  const locales = siteLocales
  const hash = signal(location.hash)
  const query = signal(parseQuery(location.search))
  const path = pathname
  const match = signal(
    matchRoute(manifest, initialSplit.pathname, resolvedPathPolicy)
  )
  const toBrowserPath = (logical: string) =>
    siteLocales && locale
      ? formatPublicPathname(logical, locale.peek(), siteLocales, resolvedPathPolicy)
      : logical
  const params = signal(match.value?.params ?? {})
  const matches = signal(buildMatchSegments(match.peek()))
  const isNavigating = signal(false)
  const currentNavigation = signal<CurrentNavigation | null>(null)
  const loaderEpoch = signal(0)
  const forceLoaderReload = signal(false)
  const isLoaderPending = signal(false)
  const isLoaderStale = signal(false)
  const validatedQuery = signal<unknown | null>(null)
  const validatedRouteParams = signal<Record<string, unknown> | null>(null)

  void (async () => {
    const initialMatch = match.peek()
    if (!initialMatch) return
    const check = await validateSearchForMatch(initialMatch, query.peek(), {
      hash: hash.peek(),
    })
    if (check.ok) {
      validatedQuery.value = check.validatedQuery ?? null
      validatedRouteParams.value = check.params
    }
  })()

  if (typeof document !== "undefined") {
    void (async () => {
      const initial = match.peek()
      if (!initial) return
      const pageHead = readPageHeadExport(await initial.route.component())
      if (isStaticPageHead(pageHead)) {
        await syncDocumentHeadForPage(
          initial,
          buildLoaderContext({
            params: initial.params,
            pathname: initial.pathname,
            search: typeof window !== "undefined" ? window.location.search : "",
            hash: hash.peek(),
            query: query.peek(),
            context: {} as CustomRequestContext,
            ...loaderI18nExtras(),
          })
        )
      }
    })()
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

  const beforeEachGuards: NavigationGuard[] = []
  const beforeResolveGuards: NavigationGuard[] = []
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

  const commitLocation = (next: RouteLocationParts) => {
    if (next.pathname !== pathname.peek()) {
      resetHydratedPageData()
      clearStreamedSsrClientState()
    }
    pathname.value = next.pathname
    hash.value = next.hash
    query.value = next.query
    const nextMatch = matchRoute(manifest, next.pathname, resolvedPathPolicy)
    match.value = nextMatch
    params.value = nextMatch?.params ?? {}
    matches.value = buildMatchSegments(nextMatch)
    if (typeof document !== "undefined" && nextMatch) {
      void (async () => {
        const pageHead = readPageHeadExport(await nextMatch.route.component())
        if (isStaticPageHead(pageHead)) {
          await syncDocumentHeadForPage(
            nextMatch,
            buildLoaderContext({
              params: nextMatch.params,
              pathname: nextMatch.pathname,
              search: (() => {
                const qs = buildQueryString(next.query)
                return qs ? `?${qs}` : ""
              })(),
              hash: next.hash,
              query: next.query,
              context: {} as CustomRequestContext,
              ...loaderI18nExtras(),
            })
          )
        }
      })()
    }
  }

  const lastNavigationHolder: {
    entry?: NonNullable<Router["__lastNavigation"]>
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
      beforeEachGuards,
      beforeResolveGuards,
      afterEachHooks,
      leaveByRoute,
      updateByRoute,
      componentEnterGuards,
      history,
      navToken,
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
      siteLocales,
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

  if (typeof window !== "undefined" && siteLocales) {
    const initialDetailed = splitAppPathnameDetailed(rawInitialPath, siteLocales)
    if (
      initialDetailed.kind === "invalid-locale" &&
      !shouldRejectInvalidLocale(siteLocales)
    ) {
      const redirectPath = resolveInvalidLocaleRedirect(
        initialDetailed,
        siteLocales,
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
      forceLoaderReload.value = true
      loaderEpoch.value += 1
    },
    navigationMode: "history",
    navigate(to, replaceOrOptions = false) {
      const options =
        typeof replaceOrOptions === "boolean"
          ? { replace: replaceOrOptions }
          : (replaceOrOptions ?? {})
      const prevHash = hash.peek()
      const logical = joinPath(pathname.peek(), to)
      const href =
        options.locale !== undefined && siteLocales && locale
          ? options.locale === false
            ? formatPathname(logical, resolvedPathPolicy)
            : formatPublicPathname(
                logical,
                options.locale,
                siteLocales,
                resolvedPathPolicy
              )
          : toBrowserPath(logical)
      const currentHref = `${origin}${addBase(
        toBrowserPath(pathname.peek()),
        normalizedBaseUrl
      )}`
      const url = new URL(addBase(href, normalizedBaseUrl), currentHref)
      return navigateInternal(url, {
        replace: !!options.replace,
        fromPopstate: false,
        enableTransition: options.transition,
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
        if (typeof window !== "undefined" && !options.replace) {
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
    locales,
    locale,
    defaultLocale: i18n?.default,
    resolveHref(to, hrefOpts) {
      return resolveRouterHref(
        pathname.value,
        to,
        hrefOpts,
        locales,
        locale ? locale.peek() : undefined,
        resolvedPathPolicy,
        normalizedBaseUrl
      )
    },
    ...(i18n && siteLocales && locale && i18nRuntime
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
            const qs = buildQueryString(query.peek())
            const search = qs ? `?${qs}` : ""
            const href = formatPublicHref(
              pathname.peek(),
              nextLocale,
              siteLocales,
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
    beforeEach(guard) {
      beforeEachGuards.push(guard)
      return () => removeArrayEntry(beforeEachGuards, guard)
    },
    beforeResolve(guard) {
      beforeResolveGuards.push(guard)
      return () => removeArrayEntry(beforeResolveGuards, guard)
    },
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
    __registerComponentGuard(kind, guard, routeId = "_") {
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
    get __lastNavigation() {
      return lastNavigationHolder.entry
    },
    ...(i18n && i18nRuntime
      ? {
          __i18n: {
            config: i18n,
            runtime: i18nRuntime,
            value: i18nRuntime.value,
          },
        }
      : {}),
  }

  registerKiruRouter(routerRef)
  return routerRef
}

export function createStaticRouter({
  manifest,
  pathname,
  hash = "",
  query = {},
  pathPolicy,
  siteLocales,
  locale,
}: {
  manifest: RouteManifest
  pathname: string
  hash?: string
  query?: RouterQuery
  pathPolicy?: RouterPathPolicy
  siteLocales?: SiteLocales
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

  return {
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
        siteLocales,
        locale,
        resolvedPathPolicy,
        normalizedBaseUrl
      )
    },
    beforeEach() {
      return emptyUnsub
    },
    beforeResolve() {
      return emptyUnsub
    },
    afterEach() {
      return emptyUnsub
    },
    back() {},
    forward() {},
    go() {},
    dispose() {},
    __registerComponentGuard() {
      return emptyUnsub
    },
  }
}

const RouterContext = createContext<Router | null>(null)

export interface RouterProviderProps {
  router: Router
  children?: JSX.Children
}

export function RouterProvider({ router, children }: RouterProviderProps) {
  return createElement(RouterContext, { value: router, children })
}

export function useRouter(): Router {
  const router = useContext(RouterContext)
  if (!router) throw new Error("useRouter must be used inside RouterProvider")
  return router
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

function prefetchMatchedRoute(
  manifest: RouteManifest,
  href: string,
  baseUrl: string
) {
  const match = matchRoute(manifest, stripBase(href, baseUrl))
  if (!match) return
  for (const scope of match.route.scopes) scope.layout?.()
  void match.route.component()
}

export type LinkProps = JSX.IntrinsicElements["a"] & {
  to: string
  replace?: boolean
  prefetch?: "hover" | "visible" | "none"
  /** Prepends locale segment when router was created with `locales`. `false` opts out. */
  locale?: string | false
  children?: JSX.Children
}

export const Link: Kiru.Component<LinkProps> = () => {
  const $ = setup<typeof Link>()
  const router = useRouter()

  const href = $.derive(({ to, locale }) =>
    router.resolveHref(
      to,
      locale === false ? { locale: false } : locale ? { locale } : undefined
    )
  )
  const onpointerenter: Kiru.PointerEventHandler<HTMLAnchorElement> = (
    event
  ) => {
    $.props.onpointerenter?.(event)
    if (event.defaultPrevented) return
    if (
      $.props.prefetch === "none" ||
      router.navigationMode !== "history" ||
      $.props.prefetch === "visible"
    ) {
      return
    }
    prefetchMatchedRoute(router.manifest, href.peek(), router.baseUrl)
  }

  onMount(() => {
    if ($.props.prefetch === "visible" && router.navigationMode === "history") {
      prefetchMatchedRoute(router.manifest, href.peek(), router.baseUrl)
    }
  })

  const onclick: Kiru.MouseEventHandler<HTMLAnchorElement> = (event) => {
    $.props.onclick?.(event)
    if (event.defaultPrevented) return
    event.preventDefault()
    const { to, replace, locale: linkLocale } = $.props
    void router.navigate(
      to,
      linkLocale !== undefined ? { replace, locale: linkLocale } : replace
    )
  }

  return ({ to, replace, children, ...rest }) =>
    createElement("a", { children, href, onpointerenter, onclick, ...rest })
}

/**
 * CSR route outlet: loads the matched route tree on navigation.
 *
 * For SSR/SSG documents use `createRouterApp` from `kiru/router/ssr` or
 * `kiru/router/ssg` (or `bootstrapSsrClient` / `bootstrapSsgClient` from
 * `kiru/ssr/router`). `RouterView` alone does not preload the server route
 * subtree or serialized loader data required for hydration.
 */
export function RouterView() {
  const router = useRouter()
  const { match, pathname, manifest, hash, query, loaderEpoch } = router
  let epoch = 0
  const children = resource(
    { match, pathname, loaderEpoch },
    async ({ match, pathname }) => {
      const e = ++epoch
      router.isLoaderPending.value = true
      try {
        const tree = match
          ? await loadRouteTree(match)
          : await loadNotFoundRouteTree(manifest, pathname)
        if (epoch !== e) return

        let leafProps: LeafRouteProps = {}
        let routeModule = tree?.routeModule
        if (match && tree) {
          const mod = await match.route.component()
          const loaderCtx = buildLoaderContext({
            params:
              router.validatedRouteParams.peek() ?? match.params,
            pathname: match.pathname,
            search: (() => {
              const qs = buildQueryString(query.peek())
              return qs ? `?${qs}` : ""
            })(),
            hash: hash.peek(),
            query: query.peek(),
            validatedQuery: router.validatedQuery.peek() as
              | Record<string, unknown>
              | undefined,
            context: {} as CustomRequestContext,
            ...(router.__i18n && router.locale
              ? loaderI18nFields(
                  router.__i18n.config,
                  router.locale.peek()
                )
              : {}),
          })
          const prepared = await prepareRouteForNavigation({
            pageMod: mod,
            routeModule: tree.routeModule,
            loaderCtx,
            options: {
              useHydratedPageData: true,
              forceReload: router.forceLoaderReload.peek(),
              routeId: match.route.id,
              onCacheRefreshed: () => {
                router.loaderEpoch.value += 1
              },
            },
          })
          router.forceLoaderReload.value = false
          router.isLoaderStale.value = prepared.isLoaderStale === true
          routeModule = prepared.routeModule
          leafProps = prepared.leafProps
          if (!prepared.usesLoadGate) {
            await syncDocumentHeadForPage(
              match,
              loaderCtx,
              leafProps as PageProps<KiruLoader<unknown>>
            )
          }
        }

        return tree && routeModule
          ? buildRoutedSubtree(tree.layoutModules, routeModule, leafProps)
          : null
      } finally {
        if (epoch === e) router.isLoaderPending.value = false
      }
    }
  )

  onMount(() => {
    warnRouterViewWithoutSsrBootstrap()
    const onPendingChange = (pending: boolean) => {
      if (!pending) {
        if (router.isNavigating.peek()) {
          router.isNavigating.value = false
          router.currentNavigation.value = null
        }
      }
    }
    const unsub = children.isPending.subscribe(onPendingChange)
    onPendingChange(children.isPending.peek())
    return unsub
  })

  return () => children.value
}
