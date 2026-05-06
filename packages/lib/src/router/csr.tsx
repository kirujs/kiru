import { createContext, useContext } from "../context.js"
import { signal } from "../signals/base.js"
import { nextIdle } from "../scheduler.js"
import { resource } from "../resource.js"
import { ViewTransitions } from "../viewTransitions.js"
import { matchRoute } from "./manifest.js"
import { createElement } from "../element.js"
import type {
  AfterEachHook,
  NavigationFailure,
  NavigationGuard,
  NavigationRedirect,
  RouteLocation,
  RouteManifest,
  RouteMatch,
  RouteTreeDefinition,
} from "./types.js"
import { compileRouteTree } from "./manifest.js"
import { setup } from "../hooks/index.js"
import {
  buildRoutedSubtree,
  loadNotFoundRouteTree,
  loadRouteTree,
} from "./renderer.js"

function joinPath(base: string, path: string): string {
  if (path.startsWith("/")) return path
  if (base.endsWith("/")) return `${base}${path}`
  return `${base}/${path}`
}

export type RouterNavigationMode = "history" | "static"
export type RouterQuery = Record<string, string[]>

export interface Router {
  manifest: RouteManifest
  pathname: Kiru.Signal<string>
  params: Kiru.Signal<Record<string, string>>
  hash: Kiru.Signal<string>
  query: Kiru.Signal<RouterQuery>
  baseUrl: string
  path: Kiru.Signal<string>
  match: Kiru.Signal<RouteMatch | null>
  navigate: (
    to: string,
    replaceOrOptions?: boolean | { replace?: boolean; transition?: boolean }
  ) => void
  setQuery: (query: RouterQuery, options?: { replace?: boolean }) => void
  setHash: (hash: string, options?: { replace?: boolean }) => void
  resolveHref: (to: string) => string
  /** `"history"` = SPA navigation; `"static"` = prerender/SSR (native &lt;a&gt; only). */
  navigationMode: RouterNavigationMode
  beforeEach: (guard: NavigationGuard) => () => void
  beforeResolve: (guard: NavigationGuard) => () => void
  afterEach: (hook: AfterEachHook) => () => void

  /** @internal */
  __registerComponentGuard?: (
    kind: "leave" | "update" | "enter",
    guard: NavigationGuard
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

function toRedirect(value: NavigationRedirect): {
  path: string
  replace?: boolean
} {
  if (typeof value === "string") return { path: value }
  return value
}

type RouteLocationParts = {
  pathname: string
  hash: string
  query: RouterQuery
}

function normalizePathname(pathname: string): string {
  const clean = pathname.split("?")[0]?.split("#")[0] || "/"
  if (clean === "/") return "/"
  return "/" + clean.split("/").filter(Boolean).join("/")
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = normalizePathname(baseUrl)
  return normalized === "/" ? "/" : normalized.replace(/\/$/, "")
}

function stripBase(pathname: string, baseUrl: string): string {
  if (baseUrl === "/") return normalizePathname(pathname)
  if (pathname === baseUrl) return "/"
  if (pathname.startsWith(`${baseUrl}/`)) {
    return normalizePathname(pathname.slice(baseUrl.length))
  }
  return normalizePathname(pathname)
}

function addBase(pathname: string, baseUrl: string): string {
  if (baseUrl === "/") return normalizePathname(pathname)
  const normalized = normalizePathname(pathname)
  if (normalized === "/") return baseUrl
  return `${baseUrl}${normalized}`
}

function parseQuery(search: string): RouterQuery {
  const out: RouterQuery = {}
  const params = new URLSearchParams(search)
  params.forEach((value, key) => {
    ;(out[key] ??= []).push(value)
  })
  return out
}

function buildQueryString(query: RouterQuery): string {
  const params = new URLSearchParams()
  for (const [key, values] of Object.entries(query)) {
    for (const value of values) params.append(key, value)
  }
  return params.toString()
}

function parseResolvedLocation(
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

function pathFromLocation(location: Location, baseUrl: string): string {
  return stripBase(location.pathname, baseUrl)
}

async function runTransition(
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

type ScrollStackState = [number, number][]
const SCROLL_STACK_KEY = "__kiru_router_scroll_stack__"

function readScrollStack(): ScrollStackState {
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

function writeScrollStack(stack: ScrollStackState) {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(SCROLL_STACK_KEY, JSON.stringify(stack))
}

function ensureHistoryIndex(history: History): number {
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

export function createRouter({
  routes,
  history = window.history,
  location = window.location,
  baseUrl = "/",
  transition = false,
}: {
  routes: RouteTreeDefinition | RouteManifest
  history?: History
  location?: Location
  baseUrl?: string
  transition?: boolean
}): Router {
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const initialPathname = pathFromLocation(location, normalizedBaseUrl)
  const origin =
    (location as Location & { origin?: string }).origin || "http://localhost"
  const pathname = signal(initialPathname)
  const hash = signal(location.hash)
  const query = signal(parseQuery(location.search))
  const path = pathname
  const match = signal(matchRoute(manifest, initialPathname))
  const params = signal(match.value?.params ?? {})

  const beforeEachGuards: NavigationGuard[] = []
  const beforeResolveGuards: NavigationGuard[] = []
  const afterEachHooks: AfterEachHook[] = []
  const componentLeaveGuards: NavigationGuard[] = []
  const componentUpdateGuards: NavigationGuard[] = []
  const componentEnterGuards: NavigationGuard[] = []

  let navToken = 0
  const transitionsEnabled = !!transition
  let historyIndex = 0
  let scrollStack = typeof window !== "undefined" ? readScrollStack() : []

  const saveScrollAt = (index: number) => {
    if (typeof window === "undefined") return
    scrollStack[index] = [window.scrollX, window.scrollY]
    writeScrollStack(scrollStack)
  }

  const currentLocationParts = (): RouteLocationParts => ({
    pathname: pathname.peek(),
    hash: hash.peek(),
    query: query.peek(),
  })

  const commitLocation = (next: RouteLocationParts) => {
    pathname.value = next.pathname
    hash.value = next.hash
    query.value = next.query
    const nextMatch = matchRoute(manifest, next.pathname)
    match.value = nextMatch
    params.value = nextMatch?.params ?? {}
  }

  const runGuards = async (
    guards: NavigationGuard[],
    to: RouteLocation,
    from: RouteLocation | null
  ): Promise<
    | { type: "continue" }
    | { type: "cancel" }
    | { type: "redirect"; to: NavigationRedirect }
  > => {
    for (const guard of guards) {
      const out = await guard(to, from)
      if (out === false) return { type: "cancel" }
      if (out === true || out === undefined) continue
      return { type: "redirect", to: out }
    }
    return { type: "continue" }
  }

  const navigateInternal = async (
    targetUrl: URL,
    {
      replace,
      fromPopstate,
      enableTransition = transitionsEnabled,
    }: {
      replace: boolean
      fromPopstate: boolean
      enableTransition?: boolean
    }
  ) => {
    const token = ++navToken
    const resolved = parseResolvedLocation(targetUrl, normalizedBaseUrl)
    const targetPath = resolved.pathname
    const fromMatch = match.peek()
    const from = locationFromMatch(fromMatch)
    const toMatch = matchRoute(manifest, targetPath)

    const to: RouteLocation = toMatch
      ? locationFromMatch(toMatch)!
      : { pathname: targetPath, params: {} }

    let failure: NavigationFailure | undefined

    try {
      // Component-level leave guards for the currently active route component(s).
      const isLeavingRoute =
        !!fromMatch && (!toMatch || fromMatch.route.id !== toMatch.route.id)
      if (isLeavingRoute && componentLeaveGuards.length) {
        const g0 = await runGuards(componentLeaveGuards, to, from)
        if (g0.type === "cancel") {
          failure = { type: "cancelled" }
          if (fromPopstate && from) {
            history.pushState(
              null,
              "",
              addBase(from.pathname, normalizedBaseUrl)
            )
            commitLocation(currentLocationParts())
          }
          return
        }
        if (g0.type === "redirect") {
          failure = { type: "redirect", to: g0.to }
          const r = toRedirect(g0.to)
          void navigateInternal(
            new URL(addBase(r.path, normalizedBaseUrl), origin),
            {
              replace: r.replace ?? true,
              fromPopstate: false,
            }
          )
          return
        }
      }

      const g1 = await runGuards(beforeEachGuards, to, from)
      if (g1.type === "cancel") {
        failure = { type: "cancelled" }
        if (fromPopstate && from) {
          history.pushState(null, "", addBase(from.pathname, normalizedBaseUrl))
          commitLocation(currentLocationParts())
        }
        return
      }
      if (g1.type === "redirect") {
        failure = { type: "redirect", to: g1.to }
        const r = toRedirect(g1.to)
        void navigateInternal(
          new URL(addBase(r.path, normalizedBaseUrl), origin),
          {
            replace: r.replace ?? true,
            fromPopstate: false,
          }
        )
        return
      }

      // Component-level update guards for reused route component(s).
      const isUpdatingRoute =
        !!fromMatch &&
        !!toMatch &&
        fromMatch.route.id === toMatch.route.id &&
        JSON.stringify(fromMatch.params) !== JSON.stringify(toMatch.params)
      if (isUpdatingRoute && componentUpdateGuards.length) {
        const gu = await runGuards(componentUpdateGuards, to, from)
        if (gu.type === "cancel") {
          failure = { type: "cancelled" }
          if (fromPopstate && from) {
            history.pushState(
              null,
              "",
              addBase(from.pathname, normalizedBaseUrl)
            )
            commitLocation(currentLocationParts())
          }
          return
        }
        if (gu.type === "redirect") {
          failure = { type: "redirect", to: gu.to }
          const r = toRedirect(gu.to)
          void navigateInternal(
            new URL(addBase(r.path, normalizedBaseUrl), origin),
            {
              replace: r.replace ?? true,
              fromPopstate: false,
            }
          )
          return
        }
      }

      const routeGuards = toMatch?.route.beforeEnter ?? []
      const isEnteringNewRoute =
        !fromMatch || !toMatch || fromMatch.route.id !== toMatch.route.id
      if (isEnteringNewRoute && routeGuards.length) {
        const g2 = await runGuards(routeGuards, to, from)
        if (g2.type === "cancel") {
          failure = { type: "cancelled" }
          if (fromPopstate && from) {
            history.pushState(
              null,
              "",
              addBase(from.pathname, normalizedBaseUrl)
            )
            commitLocation(currentLocationParts())
          }
          return
        }
        if (g2.type === "redirect") {
          failure = { type: "redirect", to: g2.to }
          const r = toRedirect(g2.to)
          void navigateInternal(
            new URL(addBase(r.path, normalizedBaseUrl), origin),
            {
              replace: r.replace ?? true,
              fromPopstate: false,
            }
          )
          return
        }
      }

      const g3 = await runGuards(beforeResolveGuards, to, from)
      if (g3.type === "cancel") {
        failure = { type: "cancelled" }
        if (fromPopstate && from) {
          history.pushState(null, "", addBase(from.pathname, normalizedBaseUrl))
          commitLocation(currentLocationParts())
        }
        return
      }
      if (g3.type === "redirect") {
        failure = { type: "redirect", to: g3.to }
        const r = toRedirect(g3.to)
        void navigateInternal(
          new URL(addBase(r.path, normalizedBaseUrl), origin),
          {
            replace: r.replace ?? true,
            fromPopstate: false,
          }
        )
        return
      }

      if (token !== navToken) return

      if (replace) {
        saveScrollAt(historyIndex)
        history.replaceState(
          { ...history.state, index: historyIndex },
          "",
          resolved.href
        )
      } else {
        saveScrollAt(historyIndex)
        const nextIndex = historyIndex + 1
        scrollStack = scrollStack.slice(0, nextIndex)
        history.pushState(
          { ...history.state, index: nextIndex },
          "",
          resolved.href
        )
        historyIndex = nextIndex
      }
      await runTransition(() => commitLocation(resolved), enableTransition)

      // Component-level enter guards run after commit (best-effort; Kiru has no pre-activation component instance).
      if (isEnteringNewRoute && componentEnterGuards.length) {
        await runGuards(componentEnterGuards, to, from)
      }
    } catch (error) {
      failure = { type: "error", error }
      if (fromPopstate && from) {
        history.pushState(null, "", addBase(from.pathname, normalizedBaseUrl))
        commitLocation(currentLocationParts())
      }
    } finally {
      if (token !== navToken)
        return // Expose latest nav info for component hooks.
      ;(routerRef.__lastNavigation as Router["__lastNavigation"]) = {
        to,
        from,
        failure,
      }
      for (const hook of afterEachHooks) {
        try {
          hook(to, from, failure)
        } catch {
          // afterEach must not break navigation
        }
      }
    }
  }

  if (typeof window !== "undefined") {
    window.history.scrollRestoration = "manual"
    historyIndex = ensureHistoryIndex(history)
    window.addEventListener("beforeunload", () => {
      saveScrollAt(historyIndex)
      window.history.scrollRestoration = "auto"
    })
    window.addEventListener("popstate", (event) => {
      saveScrollAt(historyIndex)
      const state = event.state as { index?: number } | null
      if (typeof state?.index === "number") {
        historyIndex = state.index
      }
      void navigateInternal(new URL(window.location.href), {
        replace: true,
        fromPopstate: true,
      }).then(() => {
        const offset = scrollStack[historyIndex]
        if (offset) window.scrollTo(offset[0], offset[1])
      })
    })
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
      void navigateInternal(url, {
        replace: !!options.replace,
        fromPopstate: false,
        enableTransition: options.transition,
      }).then(() => {
        const nextHash = parseResolvedLocation(url, normalizedBaseUrl).hash
        if (prevHash !== nextHash && typeof window !== "undefined") {
          window.dispatchEvent(new HashChangeEvent("hashchange"))
        }
        if (typeof window !== "undefined" && nextHash) {
          const anchor = document.getElementById(nextHash.slice(1))
          if (anchor) {
            anchor.scrollIntoView()
            return
          }
        }
        if (typeof window !== "undefined" && !options.replace) {
          window.scrollTo(0, 0)
        }
      })
    },
    setQuery(nextQuery, options) {
      const queryString = buildQueryString(nextQuery)
      const current = `${origin}${addBase(pathname.peek(), normalizedBaseUrl)}`
      const url = new URL(current)
      url.hash = hash.peek()
      url.search = queryString ? `?${queryString}` : ""
      void navigateInternal(url, {
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
      void navigateInternal(url, {
        replace: !!options?.replace,
        fromPopstate: false,
      }).then(() => {
        const normalizedNextHash = parseResolvedLocation(
          url,
          normalizedBaseUrl
        ).hash
        if (prevHash !== normalizedNextHash && typeof window !== "undefined") {
          window.dispatchEvent(new HashChangeEvent("hashchange"))
        }
      })
    },
    resolveHref(to) {
      const joined = joinPath(pathname.value, to)
      return addBase(joined, normalizedBaseUrl)
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
    __registerComponentGuard(kind, guard) {
      const list =
        kind === "leave"
          ? componentLeaveGuards
          : kind === "update"
            ? componentUpdateGuards
            : componentEnterGuards
      list.push(guard)
      return () => removeArrayEntry(list, guard)
    },
    __lastNavigation: undefined,
  }

  return routerRef
}

export function createStaticRouter({
  manifest,
  pathname,
  hash = "",
  query = {},
  baseUrl = "/",
}: {
  manifest: RouteManifest
  pathname: string
  hash?: string
  query?: RouterQuery
  baseUrl?: string
}): Router {
  const path = signal(pathname)
  const params = signal<Record<string, string>>({})
  const hashSignal = signal(hash)
  const querySignal = signal(query)
  const match = signal(matchRoute(manifest, pathname))
  params.value = match.value?.params ?? {}
  const emptyUnsub = () => {}

  return {
    manifest,
    pathname: path,
    params,
    hash: hashSignal,
    query: querySignal,
    baseUrl: normalizeBaseUrl(baseUrl),
    path,
    match,
    navigationMode: "static",
    navigate() {},
    setQuery() {},
    setHash() {},
    resolveHref(to) {
      return addBase(joinPath(path.value, to), normalizeBaseUrl(baseUrl))
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

export type LinkProps = JSX.IntrinsicElements["a"] & {
  to: string
  replace?: boolean
  prefetch?: "hover" | "visible" | "none"
  children?: JSX.Children
}

export const Link: Kiru.FC<LinkProps> = () => {
  const $ = setup<typeof Link>()
  const router = useRouter()

  const href = $.derive(({ to }) => router.resolveHref(to))
  const onpointerenter: Kiru.PointerEventHandler<HTMLAnchorElement> = (
    event
  ) => {
    $.props.onpointerenter?.(event)
    if (event.defaultPrevented) return
    if ($.props.prefetch !== "hover" && router.navigationMode !== "history") {
      return
    }
    const match = matchRoute(
      router.manifest,
      stripBase(href.peek(), router.baseUrl)
    )
    if (!match) return
    for (const scope of match.route.scopes) scope.layout?.()
    void match.route.component()
  }

  const onclick: Kiru.MouseEventHandler<HTMLAnchorElement> = (event) => {
    $.props.onclick?.(event)
    if (event.defaultPrevented) return
    event.preventDefault()
    router.navigate($.props.to, $.props.replace)
  }

  return ({ to, replace, children, ...rest }) =>
    createElement("a", { children, href, onpointerenter, onclick, ...rest })
}

export function RouterView() {
  const router = useRouter()
  const { match, pathname, manifest } = router
  let epoch = 0
  const children = resource(
    { match, pathname },
    async ({ match, pathname }) => {
      const e = ++epoch
      const tree = match
        ? await loadRouteTree(match)
        : await loadNotFoundRouteTree(manifest, pathname)
      if (epoch !== e) return

      return tree
        ? buildRoutedSubtree(tree.layoutModules, tree.routeModule)
        : null
    }
  )

  return () => children.value
}
