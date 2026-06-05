import type { KiruLoader, LoaderContext, PageProps } from "./loaders.js"
import { mergeAndSyncClientDocumentHead } from "./documentHeadClient.js"
import { mergeRouteHead } from "./meta.js"
import { resolvePagePropsFromModule } from "./runPageLoad.js"
import {
  canCommitLoaderResult,
  type NavigationScope,
  throwIfAborted,
} from "./navigationScope.js"
import type { RouteHeadMeta } from "./types.js"

export type PageHeadKind = "static" | "dynamic"

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
  signal: LoaderContext["signal"]
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
export type DynamicPageHead = KiruPageHead & { __kiruPageHead: "dynamic" }

export type PageHeadInvokeResult =
  | { kind: "sync"; value: RouteHeadMeta }
  | { kind: "async"; promise: Promise<RouteHeadMeta> }

export function defineHeadContent(meta: RouteHeadMeta): StaticPageHead
export function defineHeadContent<TLoader extends KiruLoader<unknown>>(
  fn: (ctx: DynamicHeadContext<TLoader>) => RouteHeadMeta
): DynamicPageHead
export function defineHeadContent<TLoader extends KiruLoader<unknown>>(
  fn: (ctx: DynamicHeadContext<TLoader>) => Promise<RouteHeadMeta>
): DynamicPageHead
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
  return {
    __kiruPageHead: "dynamic",
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
    signal: loaderCtx.signal,
    locale: loaderCtx.locale,
    locales: loaderCtx.locales,
    defaultLocale: loaderCtx.defaultLocale,
    loader: async () => {
      if (cached) return cached
      throwIfAborted(loaderCtx.signal)
      const resolved = await resolvePagePropsFromModule(pageMod, loaderCtx)
      if (resolved.discarded) {
        throw new DOMException("Aborted", "AbortError")
      }
      cached = resolved.props as PageProps<KiruLoader<unknown>>
      return cached
    },
  }
}

export function invokePageHeadResolve(
  head: KiruPageHead,
  ctx: DynamicHeadContext
): PageHeadInvokeResult {
  if (isStaticPageHead(head)) {
    return { kind: "sync", value: head.resolve(ctx) as RouteHeadMeta }
  }
  const out = head.resolve(ctx)
  if (out instanceof Promise) {
    return { kind: "async", promise: out }
  }
  return { kind: "sync", value: out }
}

export async function resolvePageHead(
  head: KiruPageHead,
  ctx: DynamicHeadContext
): Promise<RouteHeadMeta> {
  const invoked = invokePageHeadResolve(head, ctx)
  return invoked.kind === "sync" ? invoked.value : await invoked.promise
}

export function resolvePageHeadSync(
  head: KiruPageHead,
  ctx: DynamicHeadContext
): RouteHeadMeta {
  const invoked = invokePageHeadResolve(head, ctx)
  if (invoked.kind === "async") {
    throw new Error(
      "[kiru/router] Page head returned a Promise; await resolvePageHead instead."
    )
  }
  return invoked.value
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

export function isStaticPageHead(head: KiruPageHead | undefined): boolean {
  return head?.__kiruPageHead === "static"
}

export function isDynamicPageHead(head: KiruPageHead | undefined): boolean {
  return head?.__kiruPageHead === "dynamic"
}

export function pageHeadResolveIsAsync(
  head: KiruPageHead,
  ctx: DynamicHeadContext
): boolean {
  return invokePageHeadResolve(head, ctx).kind === "async"
}

export type SyncDocumentHeadCommit = {
  scope?: NavigationScope
  getNavGeneration?: () => number
}

/** Update `document.title` from route + page exports (CSR / post-hydration navigations). */
export async function syncDocumentHeadForPage(
  match: {
    route: { head: RouteHeadMeta; component: () => Promise<unknown> }
    params: Record<string, string>
    pathname: string
  },
  loaderCtx: LoaderContext,
  pageProps?: PageProps<KiruLoader<unknown>>,
  pageMod?: unknown,
  commit?: SyncDocumentHeadCommit
): Promise<void> {
  const getNavGeneration = commit?.getNavGeneration ?? (() => 0)
  if (!canCommitLoaderResult(commit?.scope, getNavGeneration)) return
  throwIfAborted(loaderCtx.signal)

  const mod = pageMod ?? (await match.route.component())
  throwIfAborted(loaderCtx.signal)
  if (!canCommitLoaderResult(commit?.scope, getNavGeneration)) return

  const pageHead = readPageHeadExport(mod)
  const headCtx = createDynamicHeadContext(loaderCtx, mod, pageProps)
  let pageHeadMeta: RouteHeadMeta | undefined
  if (pageHead) {
    pageHeadMeta = await resolvePageHead(pageHead, headCtx)
  }
  if (!canCommitLoaderResult(commit?.scope, getNavGeneration)) return
  throwIfAborted(loaderCtx.signal)
  mergeAndSyncClientDocumentHead(match.route.head, pageHeadMeta, {
    pathname: match.pathname,
  })
}
