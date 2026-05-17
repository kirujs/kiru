import type { RouterQuery } from "./csr.js"
import type { KiruLoader, LoaderContext, PageProps } from "./loaders.js"
import { isKiruLoader, readPageLoadExport } from "./loaders.js"
import type { CustomRequestContext, RouteMatch } from "./types.js"
import { toRenderError } from "./types.js"
import { readHydratedPageData } from "./pageData.js"

export type LoaderFetchContext = {
  params: Record<string, string>
  pathname: string
  search: string
  hash: string
  query: RouterQuery
  context: CustomRequestContext
  request?: Request
}

export function buildLoaderContext(input: LoaderFetchContext): LoaderContext {
  return {
    params: input.params,
    url: {
      pathname: input.pathname,
      search: input.search,
      hash: input.hash,
    },
    query: input.query,
    context: input.context,
    request: input.request,
  }
}

export async function runPageLoadFromModule(
  mod: unknown,
  ctx: LoaderContext
): Promise<unknown> {
  const load = readPageLoadExport(mod)
  if (!load) return undefined
  if (load.__kiruLoader === "static" && typeof window !== "undefined") {
    return undefined
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

/** Run `load` and shape props for the page component (no loading state). */
export async function resolvePagePropsFromModule(
  mod: unknown,
  ctx: LoaderContext,
  options?: { useHydratedPageData?: boolean }
): Promise<PageProps<KiruLoader<unknown>> | Record<string, never>> {
  const load = readPageLoadExport(mod)
  if (!load) return {}
  if (
    options?.useHydratedPageData !== false &&
    load.__kiruLoader === "server" &&
    typeof document !== "undefined"
  ) {
    const hydrated = readHydratedPageData()
    if (hydrated !== undefined) {
      return buildPageProps(hydrated)
    }
  }
  try {
    const data = await runPageLoadFromModule(mod, ctx)
    return buildPageProps(data)
  } catch (err) {
    return buildPageErrorProps(err)
  }
}
