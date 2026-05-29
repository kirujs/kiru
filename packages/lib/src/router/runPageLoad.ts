import type { RouterQuery } from "./requestUrl.js"
import type { KiruLoader, LoaderContext, PageProps } from "./loaders.js"
import { isKiruLoader, readPageLoadExport } from "./loaders.js"
import { loaderI18nFields } from "./i18n/createI18nConfig.js"
import { tryGetRouterRuntime } from "./routerRuntime.js"
import { mergeRouteMeta } from "./routeMeta.js"
import { formatRouterSearch } from "./navigation.js"
import type { CustomRequestContext, RouteMatch, RouteMeta } from "./types.js"
import { toRenderError } from "./types.js"
import { readHydratedPageData } from "./pageData.js"
import { __DEV__, __KIRU_PURE_CLIENT__, __KIRU_SSR__ } from "../env.js"
import {
  warnOnce,
  SERVER_LOADER_PURE_CLIENT_DEV_MSG,
  SERVER_LOADER_NO_RPC_DEV_MSG,
} from "./devWarnings.dev.js"
import {
  buildLoaderCacheKey,
  getLoaderCacheEntry,
  isLoaderCacheStale,
  scheduleStaleLoaderRevalidate,
  setLoaderCacheEntry,
  type LoaderCacheEntry,
} from "./loaderCache.js"
import { readLoaderCacheOptions } from "./loaders.js"
import {
  buildScopeCacheKey,
  canCommitLoaderResult,
  isAbortError,
  type NavigationScope,
  throwIfAborted,
} from "./navigationScope.js"
import { isRpcTraceEnabled, rpcTrace } from "../remote/rpcTrace.js"
export type LoaderFetchContext = {
  params: Record<string, unknown>
  pathname: string
  search: string
  hash: string
  query: RouterQuery
  context: CustomRequestContext
  meta?: RouteMeta
  routeId?: string
  request?: Request
  signal: AbortSignal
  locale?: string
  locales?: readonly string[]
  defaultLocale?: string
}

/** Router fields needed to build a {@link LoaderContext} for a matched route. */
export type LoaderContextRouterSlice = {
  hash: { peek(): string }
  query: { peek(): RouterQuery }
  requestContext: { peek(): CustomRequestContext }
  validatedQuery?: { peek(): unknown | null }
  validatedRouteParams?: { peek(): Record<string, unknown> | null }
  locale?: { peek(): string | null }
}

function loaderI18nFromRouter(
  router: LoaderContextRouterSlice
): ReturnType<typeof loaderI18nFields> {
  const runtime = tryGetRouterRuntime(router as import("./csr.js").Router)
  if (runtime?.i18n && router.locale) {
    return loaderI18nFields(runtime.i18n.config, router.locale.peek())
  }
  return {}
}

export function buildLoaderContextForMatch(
  router: LoaderContextRouterSlice,
  match: Pick<RouteMatch, "params" | "pathname" | "route">,
  signal: AbortSignal,
  overrides?: {
    validatedQuery?: Record<string, unknown>
    params?: Record<string, unknown>
    pathname?: string
    context?: CustomRequestContext
  }
): LoaderContext {
  const params =
    overrides?.params ??
    router.validatedRouteParams?.peek() ??
    match.params
  const pathname = overrides?.pathname ?? match.pathname
  return buildLoaderContext({
    params,
    pathname,
    search: formatRouterSearch(router.query.peek()),
    hash: router.hash.peek(),
    query: router.query.peek(),
    validatedQuery: (overrides?.validatedQuery ??
      router.validatedQuery?.peek() ??
      undefined) as Record<string, unknown> | undefined,
    context:
      overrides?.context ??
      router.requestContext.peek(),
    meta: mergeRouteMeta(match),
    routeId: match.route.id,
    signal,
    ...loaderI18nFromRouter(router),
  })
}

export function buildLoaderContext(
  input: LoaderFetchContext & { validatedQuery?: Record<string, unknown> }
): LoaderContext {
  return {
    params: input.params as LoaderContext["params"],
    url: {
      pathname: input.pathname,
      search: input.search,
      hash: input.hash,
    },
    query: (input.validatedQuery ?? input.query) as LoaderContext["query"],
    context: input.context,
    meta: input.meta ?? {},
    route: { id: input.routeId ?? "" },
    request: input.request,
    signal: input.signal,
    ...(input.locale !== undefined ? { locale: input.locale } : {}),
    ...(input.locales !== undefined ? { locales: input.locales } : {}),
    ...(input.defaultLocale !== undefined
      ? { defaultLocale: input.defaultLocale }
      : {}),
  }
}

export async function runPageLoadFromModule(
  mod: unknown,
  ctx: LoaderContext
): Promise<unknown> {
  throwIfAborted(ctx.signal)
  const load = readPageLoadExport(mod)
  if (!load) return undefined
  if (load.__kiruLoader === "server" && typeof window !== "undefined") {
    if (__KIRU_PURE_CLIENT__) {
      if (__DEV__) warnOnce("server-loader-pure-client", SERVER_LOADER_PURE_CLIENT_DEV_MSG)
      throw new Error(SERVER_LOADER_PURE_CLIENT_DEV_MSG)
    }
    if (__DEV__ && __KIRU_SSR__ && !(globalThis as Record<string, unknown>).__kiru_loaders) {
      warnOnce("server-loader-without-rpc", SERVER_LOADER_NO_RPC_DEV_MSG)
    }
  }
  const data = await load.__kiruInvoke(ctx)
  throwIfAborted(ctx.signal)
  return data
}

export async function runPageLoadForMatch(
  _match: RouteMatch,
  ctx: LoaderFetchContext,
  options: {
    loadModule: () => Promise<unknown>
  }
): Promise<unknown> {
  const loaderCtx = buildLoaderContext(ctx)
  const mod = await options.loadModule()
  return runPageLoadFromModule(mod, loaderCtx)
}

export function getLoaderKind(mod: unknown): KiruLoader["__kiruLoader"] | null {
  const load = readPageLoadExport(mod)
  return load && isKiruLoader(load) ? load.__kiruLoader : null
}

export function buildPageProps<T>(data: T): PageProps<KiruLoader<T>> {
  return { data, error: null }
}

export function buildPageErrorProps(
  err: unknown
): PageProps<KiruLoader<unknown>> {
  return { data: null, error: toRenderError(err) }
}

export type ResolvePagePropsOptions = {
  useHydratedPageData?: boolean
  forceReload?: boolean
  routeId?: string
  /** Called after a background refetch updates the loader cache (stale entry). */
  onCacheRefreshed?: () => void
  scope?: NavigationScope
  getNavGeneration?: () => number
}

export type ResolvePagePropsResult = {
  props: PageProps<KiruLoader<unknown>> | Record<string, never>
  /** True when serving cached loader data past `staleTime`. */
  isStale?: boolean
  /** Navigation or request was superseded; do not commit props to the outlet. */
  discarded?: boolean
}

/** Run `load` and shape props for the page component (no loading state). */
function pageTrace(
  phase: string,
  meta?: Record<string, string | number | boolean>
): void {
  if (!isRpcTraceEnabled()) return
  rpcTrace({ channel: "page", phase, meta })
}

export async function resolvePagePropsFromModule(
  mod: unknown,
  ctx: LoaderContext,
  options?: ResolvePagePropsOptions
): Promise<ResolvePagePropsResult> {
  const load = readPageLoadExport(mod)
  if (!load) return { props: {} }
  pageTrace("page_load_start", {
    routeId: options?.routeId ?? "",
    pathname: ctx.url.pathname,
    loaderKind: load.__kiruLoader,
  })
  const useHydrated =
    options?.forceReload === true ? false : options?.useHydratedPageData !== false
  const cacheOpts = readLoaderCacheOptions(load)
  const routeId = options?.routeId
  const scope = options?.scope
  const getNavGeneration =
    options?.getNavGeneration ?? (() => scope?.generation ?? 0)

  const cacheKey =
    routeId !== undefined
      ? buildScopeCacheKey(routeId, ctx.url.pathname, ctx.url.search)
      : undefined

  const canCommit = () =>
    canCommitLoaderResult(scope, getNavGeneration, cacheKey)

  const discard = (): ResolvePagePropsResult => {
    pageTrace("page_load_discarded", { discarded: true })
    return { props: {}, discarded: true }
  }

  const seedLoaderCacheFromHydrated = (data: unknown): void => {
    if (
      typeof document === "undefined" ||
      !routeId ||
      (load.__kiruLoader !== "client" && load.__kiruLoader !== "universal")
    ) {
      return
    }
    if (!canCommit()) return
    const key = buildLoaderCacheKey(routeId, ctx.url.pathname, ctx.url.search)
    const entry: LoaderCacheEntry = {
      data,
      fetchedAt: Date.now(),
      staleTime: cacheOpts.staleTime,
      gcTime: cacheOpts.gcTime,
    }
    setLoaderCacheEntry(key, entry)
  }

  if (useHydrated && typeof document !== "undefined") {
    const hydrated = readHydratedPageData()
    if (hydrated !== undefined) {
      if (
        load.__kiruLoader === "server" ||
        load.__kiruLoader === "static" ||
        load.__kiruLoader === "universal"
      ) {
        seedLoaderCacheFromHydrated(hydrated)
        pageTrace("hydrate_seed", { loaderKind: load.__kiruLoader })
        pageTrace("page_load_done", { source: "hydrate" })
        return { props: buildPageProps(hydrated) }
      }
    }
    if (load.__kiruLoader === "server") {
      if (__KIRU_PURE_CLIENT__) {
        if (__DEV__) warnOnce("server-loader-pure-client", SERVER_LOADER_PURE_CLIENT_DEV_MSG)
        throw new Error(SERVER_LOADER_PURE_CLIENT_DEV_MSG)
      }
      if (__DEV__ && __KIRU_SSR__ && !(globalThis as Record<string, unknown>).__kiru_loaders) {
        warnOnce("server-loader-without-rpc", SERVER_LOADER_NO_RPC_DEV_MSG)
      }
    }
  }
  if (
    typeof document !== "undefined" &&
    routeId &&
    !options?.forceReload &&
    (load.__kiruLoader === "client" ||
      load.__kiruLoader === "universal" ||
      load.__kiruLoader === "server")
  ) {
    const key = buildLoaderCacheKey(routeId, ctx.url.pathname, ctx.url.search)
    const cached = getLoaderCacheEntry(key)
    if (cached) {
      // staleTime 0: serve cached data for prefetch + in-flight navigation dedupe
      // without background revalidate (which would loop with loaderEpoch).
      if (cached.staleTime === 0) {
        pageTrace("cache_hit", { staleTimeZero: true })
        pageTrace("page_load_done", { source: "cache" })
        return { props: buildPageProps(cached.data), isStale: false }
      }
      if (!isLoaderCacheStale(cached)) {
        pageTrace("cache_hit", { stale: false })
        pageTrace("page_load_done", { source: "cache" })
        return { props: buildPageProps(cached.data), isStale: false }
      }
      pageTrace("cache_stale_served", {})
      const revalidateScope = scope
      const revalidateKey = cacheKey
      scheduleStaleLoaderRevalidate(key, async () => {
        try {
          const data = await runPageLoadFromModule(mod, ctx)
          if (
            !canCommitLoaderResult(
              revalidateScope,
              getNavGeneration,
              revalidateKey
            )
          ) {
            return
          }
          setLoaderCacheEntry(key, {
            data,
            fetchedAt: Date.now(),
            staleTime: cacheOpts.staleTime,
            gcTime: cacheOpts.gcTime,
          })
          options?.onCacheRefreshed?.()
        } catch (err) {
          if (isAbortError(err)) return
          // keep showing stale data until invalidate or next navigation
        }
      })
      pageTrace("page_load_done", { source: "cache_stale" })
      return { props: buildPageProps(cached.data), isStale: true }
    }
    pageTrace("cache_miss", {})
  }

  if (load.__kiruLoader === "server" && typeof window !== "undefined") {
    pageTrace("loader_rpc_dispatch", { routeId: routeId ?? "" })
  }

  try {
    const data = await runPageLoadFromModule(mod, ctx)
    if (!canCommit()) return discard()
    if (typeof document !== "undefined" && routeId) {
      const key = buildLoaderCacheKey(routeId, ctx.url.pathname, ctx.url.search)
      setLoaderCacheEntry(key, {
        data,
        fetchedAt: Date.now(),
        staleTime: cacheOpts.staleTime,
        gcTime: cacheOpts.gcTime,
      })
    }
    pageTrace("page_load_done", { source: "fetch", hasError: false })
    return { props: buildPageProps(data), isStale: false }
  } catch (err) {
    if (isAbortError(err) || ctx.signal.aborted) return discard()
    if (!canCommit()) return discard()
    pageTrace("page_load_done", { source: "fetch", hasError: true })
    return { props: buildPageErrorProps(err), isStale: false }
  }
}
