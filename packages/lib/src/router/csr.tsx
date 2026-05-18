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
import {
  canStreamPageLoad,
  readLoaderFallback,
  readPageLoadExport,
  type KiruLoader,
  type PageProps,
} from "./loaders.js"
import { buildLoaderContext, resolvePagePropsFromModule } from "./runPageLoad.js"
import {
  clearStreamedSsrClientState,
  resetHydratedPageData,
} from "./pageData.js"
import { isStaticPageHead, readPageHeadExport, syncDocumentHeadForPage } from "./pageHead.js"
import { wrapRouteModuleWithLoadGate } from "./pageLoadGate.js"
import type { CustomRequestContext } from "./types.js"
import { warnRouterViewWithoutSsrBootstrap } from "./devWarnings.js"

function joinPath(base: string, path: string): string {
  if (path.startsWith("/")) return path
  if (base.endsWith("/")) return `${base}${path}`
  return `${base}/${path}`
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
    replaceOrOptions?: boolean | { replace?: boolean; transition?: boolean }
  ) => Promise<NavigationResult>
  setQuery: (
    query: RouterQuery,
    options?: { replace?: boolean }
  ) => Promise<NavigationResult>
  setHash: (
    hash: string,
    options?: { replace?: boolean }
  ) => Promise<NavigationResult>
  resolveHref: (to: string) => string
  /** `"history"` = SPA navigation; `"static"` = prerender/SSR (native &lt;a&gt; only). */
  navigationMode: RouterNavigationMode
  beforeEach: (guard: NavigationGuard) => () => void
  beforeResolve: (guard: NavigationGuard) => () => void
  afterEach: (hook: AfterEachHook) => () => void
  isNavigating: Kiru.Signal<boolean>
  currentNavigation: Kiru.Signal<CurrentNavigation | null>
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
}: {
  routes: RouteTreeDefinition | RouteManifest
  history?: History
  location?: Location
  pathPolicy?: RouterPathPolicy
  transition?: boolean
}): Router {
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const resolvedPathPolicy = resolvePathPolicy(pathPolicy)
  const normalizedBaseUrl = resolvedPathPolicy.baseUrl
  const initialPathname = pathFromLocation(location, normalizedBaseUrl)
  const origin =
    (location as Location & { origin?: string }).origin || "http://localhost"
  const pathname = signal(initialPathname)
  const hash = signal(location.hash)
  const query = signal(parseQuery(location.search))
  const path = pathname
  const match = signal(
    matchRoute(manifest, initialPathname, resolvedPathPolicy)
  )
  const params = signal(match.value?.params ?? {})
  const matches = signal(buildMatchSegments(match.peek()))
  const isNavigating = signal(false)
  const currentNavigation = signal<CurrentNavigation | null>(null)

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
      commitLocation,
      buildMatchSegments,
      locationFromMatch,
      snapshotFromParts,
      currentLocationParts,
      setLastNavigation: (entry) => {
        lastNavigationHolder.entry = entry
      },
    },
    transitionsEnabled
  )

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
    navigationMode: "history",
    navigate(to, replaceOrOptions = false) {
      const options =
        typeof replaceOrOptions === "boolean"
          ? { replace: replaceOrOptions }
          : replaceOrOptions
      const prevHash = hash.peek()
      const href = joinPath(pathname.peek(), to)
      const currentHref = `${origin}${addBase(
        pathname.peek(),
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
      const current = `${origin}${addBase(pathname.peek(), normalizedBaseUrl)}`
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
      const current = `${origin}${addBase(pathname.peek(), normalizedBaseUrl)}`
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
    resolveHref(to) {
      const joined = joinPath(pathname.value, to)
      return addBase(
        formatPathname(joined, resolvedPathPolicy),
        normalizedBaseUrl
      )
    },
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
  }

  return routerRef
}

export function createStaticRouter({
  manifest,
  pathname,
  hash = "",
  query = {},
  pathPolicy,
}: {
  manifest: RouteManifest
  pathname: string
  hash?: string
  query?: RouterQuery
  pathPolicy?: RouterPathPolicy
}): Router {
  const resolvedPathPolicy = resolvePathPolicy(pathPolicy)
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
    resolveHref(to) {
      return addBase(
        formatPathname(joinPath(path.value, to), resolvedPathPolicy),
        resolvedPathPolicy.baseUrl
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
  children?: JSX.Children
}

export const Link: Kiru.Component<LinkProps> = () => {
  const $ = setup<typeof Link>()
  const router = useRouter()

  const href = $.derive(({ to }) => router.resolveHref(to))
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
    void router.navigate($.props.to, $.props.replace)
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
  const { match, pathname, manifest, hash, query } = router
  let epoch = 0
  const children = resource(
    { match, pathname },
    async ({ match, pathname }) => {
      const e = ++epoch
      const tree = match
        ? await loadRouteTree(match)
        : await loadNotFoundRouteTree(manifest, pathname)
      if (epoch !== e) return

      let leafProps: LeafRouteProps = {}
      let routeModule = tree?.routeModule
      if (match && tree) {
        const mod = await match.route.component()
        const loaderCtx = buildLoaderContext({
          params: match.params,
          pathname: match.pathname,
          search: (() => {
            const qs = buildQueryString(query.peek())
            return qs ? `?${qs}` : ""
          })(),
          hash: hash.peek(),
          query: query.peek(),
          context: {} as CustomRequestContext,
        })
        const load = readPageLoadExport(mod)
        const pageHead = readPageHeadExport(mod)
        if (canStreamPageLoad(load) && isStaticPageHead(pageHead)) {
          const fallback = readLoaderFallback(load)
          if (fallback) {
            routeModule = wrapRouteModuleWithLoadGate(
              tree.routeModule,
              load!,
              loaderCtx,
              fallback
            )
            leafProps = {}
          }
        } else {
          leafProps = await resolvePagePropsFromModule(mod, loaderCtx)
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
