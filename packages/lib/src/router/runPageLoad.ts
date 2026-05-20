import type { RouterQuery } from "./csr.js"
import type { KiruLoader, LoaderContext, PageProps } from "./loaders.js"
import { isKiruLoader, readPageLoadExport } from "./loaders.js"
import type { CustomRequestContext, RouteMatch, RouteMeta } from "./types.js"
import { toRenderError } from "./types.js"
import { readHydratedPageData } from "./pageData.js"
import { guardServerLoaderOnClient } from "./devWarnings.js"
import {
  buildLoaderCacheKey,
  getLoaderCacheEntry,
  isLoaderCacheStale,
  setLoaderCacheEntry,
  type LoaderCacheEntry,
} from "./loaderCache.js"
import { readLoaderCacheOptions } from "./loaders.js"

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
  locale?: string
  locales?: readonly string[]
  defaultLocale?: string
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
  const load = readPageLoadExport(mod)
  if (!load) return undefined
  if (load.__kiruLoader === "server" && typeof window !== "undefined") {
    guardServerLoaderOnClient()
  }
  return load.__kiruInvoke(ctx)
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

export type ResolvePagePropsResult = {
  props: PageProps<KiruLoader<unknown>> | Record<string, never>
  /** True when serving cached loader data past `staleTime`. */
  isStale?: boolean
}

/** Run `load` and shape props for the page component (no loading state). */
export async function resolvePagePropsFromModule(
  mod: unknown,
  ctx: LoaderContext,
  options?: {
    useHydratedPageData?: boolean
    forceReload?: boolean
    routeId?: string
    /** Called after a background refetch updates the loader cache (stale entry). */
    onCacheRefreshed?: () => void
  }
): Promise<ResolvePagePropsResult> {
  const load = readPageLoadExport(mod)
  if (!load) return { props: {} }
  const useHydrated =
    options?.forceReload === true ? false : options?.useHydratedPageData !== false
  const cacheOpts = readLoaderCacheOptions(load)
  const routeId = options?.routeId

  const seedLoaderCacheFromHydrated = (data: unknown): void => {
    if (
      typeof document === "undefined" ||
      !routeId ||
      (load.__kiruLoader !== "client" && load.__kiruLoader !== "universal")
    ) {
      return
    }
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
        return { props: buildPageProps(hydrated) }
      }
    }
    if (load.__kiruLoader === "server") {
      guardServerLoaderOnClient()
    }
  }
  if (
    typeof document !== "undefined" &&
    routeId &&
    !options?.forceReload &&
    (load.__kiruLoader === "client" || load.__kiruLoader === "universal")
  ) {
    const key = buildLoaderCacheKey(routeId, ctx.url.pathname, ctx.url.search)
    const cached = getLoaderCacheEntry(key)
    if (cached && !isLoaderCacheStale(cached)) {
      return { props: buildPageProps(cached.data), isStale: false }
    }
    if (cached && isLoaderCacheStale(cached)) {
      void (async () => {
        try {
          const data = await runPageLoadFromModule(mod, ctx)
          setLoaderCacheEntry(key, {
            data,
            fetchedAt: Date.now(),
            staleTime: cacheOpts.staleTime,
            gcTime: cacheOpts.gcTime,
          })
          options?.onCacheRefreshed?.()
        } catch {
          // keep showing stale data until invalidate or next navigation
        }
      })()
      return { props: buildPageProps(cached.data), isStale: true }
    }
  }

  try {
    const data = await runPageLoadFromModule(mod, ctx)
    if (typeof document !== "undefined" && routeId) {
      const key = buildLoaderCacheKey(routeId, ctx.url.pathname, ctx.url.search)
      setLoaderCacheEntry(key, {
        data,
        fetchedAt: Date.now(),
        staleTime: cacheOpts.staleTime,
        gcTime: cacheOpts.gcTime,
      })
    }
    return { props: buildPageProps(data), isStale: false }
  } catch (err) {
    return { props: buildPageErrorProps(err), isStale: false }
  }
}
