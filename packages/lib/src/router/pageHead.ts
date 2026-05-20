import type { KiruLoader, LoaderContext, PageProps } from "./loaders.js"
import { mergeAndSyncClientDocumentHead } from "./documentHeadClient.js"
import { mergeRouteHead } from "./meta.js"
import { resolvePagePropsFromModule } from "./runPageLoad.js"
import type { RouteHeadMeta } from "./types.js"

export type PageHeadKind = "static" | "sync" | "async"

/** Context for {@link defineHeadContent} resolvers (not {@link LoaderContext}). */
export type DynamicHeadContext<
  TLoader extends KiruLoader<unknown> = KiruLoader<unknown>,
> = {
  params: Record<string, string>
  url: LoaderContext["url"]
  query: LoaderContext["query"]
  context: LoaderContext["context"]
  meta: LoaderContext["meta"]
  route: LoaderContext["route"]
  request?: LoaderContext["request"]
  locale?: LoaderContext["locale"]
  locales?: LoaderContext["locales"]
  defaultLocale?: LoaderContext["defaultLocale"]
  /** Page loader result — same shape as {@link PageProps}. */
  loader: () => Promise<PageProps<TLoader>>
}

export type KiruPageHead = {
  __kiruPageHead: PageHeadKind
  resolve: (
    ctx: DynamicHeadContext
  ) => RouteHeadMeta | Promise<RouteHeadMeta>
}

export type StaticPageHead = KiruPageHead & { __kiruPageHead: "static" }
export type SyncPageHead = KiruPageHead & { __kiruPageHead: "sync" }
export type AsyncPageHead = KiruPageHead & { __kiruPageHead: "async" }

export function defineHeadContent(meta: RouteHeadMeta): StaticPageHead
export function defineHeadContent<TLoader extends KiruLoader<unknown>>(
  fn: (ctx: DynamicHeadContext<TLoader>) => RouteHeadMeta
): SyncPageHead
export function defineHeadContent<TLoader extends KiruLoader<unknown>>(
  fn: (ctx: DynamicHeadContext<TLoader>) => Promise<RouteHeadMeta>
): AsyncPageHead
export function defineHeadContent<TLoader extends KiruLoader<unknown>>(
  metaOrFn:
    | RouteHeadMeta
    | ((
        ctx: DynamicHeadContext<TLoader>
      ) => RouteHeadMeta | Promise<RouteHeadMeta>)
): KiruPageHead {
  if (typeof metaOrFn !== "function") {
    return {
      __kiruPageHead: "static",
      resolve: () => metaOrFn,
    }
  }
  const isAsync = metaOrFn.constructor.name === "AsyncFunction"
  return {
    __kiruPageHead: isAsync ? "async" : "sync",
    resolve: metaOrFn as KiruPageHead["resolve"],
  }
}

export function isKiruPageHead(value: unknown): value is KiruPageHead {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruPageHead" in value &&
    typeof (value as KiruPageHead).resolve === "function"
  )
}

export function readPageHeadExport(mod: unknown): KiruPageHead | undefined {
  if (!mod || typeof mod !== "object") return undefined
  const head = (mod as Record<string, unknown>).head
  return isKiruPageHead(head) ? head : undefined
}

export function createDynamicHeadContext(
  loaderCtx: LoaderContext,
  pageMod: unknown,
  pageProps?: PageProps<KiruLoader<unknown>>
): DynamicHeadContext {
  let cached = pageProps
  return {
    params: loaderCtx.params,
    url: loaderCtx.url,
    query: loaderCtx.query,
    context: loaderCtx.context,
    meta: loaderCtx.meta,
    route: loaderCtx.route,
    request: loaderCtx.request,
    locale: loaderCtx.locale,
    locales: loaderCtx.locales,
    defaultLocale: loaderCtx.defaultLocale,
    loader: async () => {
      if (cached) return cached
      const resolved = await resolvePagePropsFromModule(pageMod, loaderCtx)
      cached = resolved.props as PageProps<KiruLoader<unknown>>
      return cached
    },
  }
}

export async function resolvePageHead(
  head: KiruPageHead,
  ctx: DynamicHeadContext
): Promise<RouteHeadMeta> {
  const out = head.resolve(ctx)
  return out instanceof Promise ? await out : out
}

export function resolvePageHeadSync(
  head: KiruPageHead,
  ctx: DynamicHeadContext
): RouteHeadMeta {
  if (head.__kiruPageHead === "static") {
    return head.resolve(ctx) as RouteHeadMeta
  }
  if (head.__kiruPageHead === "async") {
    throw new Error(
      "[kiru/router] Async defineHeadContent cannot be resolved synchronously."
    )
  }
  const out = head.resolve(ctx)
  if (out instanceof Promise) {
    throw new Error(
      "[kiru/router] Page head returned a Promise; use an async defineHeadContent function."
    )
  }
  return out
}

export function mergeRouteAndPageHead(
  routeHead: RouteHeadMeta,
  pageHead: RouteHeadMeta | undefined
): RouteHeadMeta {
  if (!pageHead) return routeHead
  return mergeRouteHead(routeHead, pageHead)
}

export async function resolveMergedRoutePageHead(
  routeHead: RouteHeadMeta,
  pageHead: KiruPageHead | undefined,
  ctx: DynamicHeadContext
): Promise<RouteHeadMeta> {
  if (!pageHead) return routeHead
  const pageMeta = await resolvePageHead(pageHead, ctx)
  return mergeRouteHead(routeHead, pageMeta)
}

export function resolveMergedRoutePageHeadSync(
  routeHead: RouteHeadMeta,
  pageHead: KiruPageHead | undefined,
  ctx: DynamicHeadContext
): RouteHeadMeta {
  if (!pageHead) return routeHead
  const pageMeta = resolvePageHeadSync(pageHead, ctx)
  return mergeRouteHead(routeHead, pageMeta)
}

export function isAsyncPageHead(head: KiruPageHead | undefined): boolean {
  return head?.__kiruPageHead === "async"
}

export function isSyncPageHead(head: KiruPageHead | undefined): boolean {
  return head?.__kiruPageHead === "sync"
}

export function isStaticPageHead(head: KiruPageHead | undefined): boolean {
  return head?.__kiruPageHead === "static"
}

/** @deprecated Use {@link isAsyncPageHead} or {@link isSyncPageHead}. */
export function isDynamicPageHead(head: KiruPageHead | undefined): boolean {
  return isAsyncPageHead(head) || isSyncPageHead(head)
}

/** Update `document.title` from route + page exports (CSR / post-hydration navigations). */
export async function syncDocumentHeadForPage(
  match: {
    route: { head: RouteHeadMeta; component: () => Promise<unknown> }
    params: Record<string, string>
    pathname: string
  },
  loaderCtx: LoaderContext,
  pageProps?: PageProps<KiruLoader<unknown>>
): Promise<void> {
  const pageMod = await match.route.component()
  const pageHead = readPageHeadExport(pageMod)
  const headCtx = createDynamicHeadContext(loaderCtx, pageMod, pageProps)
  let pageHeadMeta: RouteHeadMeta | undefined
  if (pageHead) {
    pageHeadMeta = isAsyncPageHead(pageHead)
      ? await resolvePageHead(pageHead, headCtx)
      : resolvePageHeadSync(pageHead, headCtx)
  }
  mergeAndSyncClientDocumentHead(match.route.head, pageHeadMeta, {
    pathname: match.pathname,
  })
}
