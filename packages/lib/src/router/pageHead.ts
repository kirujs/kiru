import type { KiruLoader, LoaderContext, PageProps } from "./loaders.js"
import { mergeAndSyncClientDocumentHead } from "./documentHeadClient.js"
import { mergeRouteHead, resolveMetaTemplates } from "./meta.js"
import type { RouteHeadMeta } from "./types.js"

export type PageHeadKind = "static" | "dynamic"

export type KiruPageHead = {
  __kiruPageHead: PageHeadKind
  resolve: (
    ctx: LoaderContext,
    pageProps?: PageProps<KiruLoader<unknown>>
  ) => RouteHeadMeta
}

export type StaticPageHead = KiruPageHead & { __kiruPageHead: "static" }
export type DynamicPageHead = KiruPageHead & { __kiruPageHead: "dynamic" }

export function defineHeadContent(meta: RouteHeadMeta): StaticPageHead
export function defineHeadContent<TLoader extends KiruLoader<unknown>>(
  fn: (ctx: LoaderContext, props: PageProps<TLoader>) => RouteHeadMeta
): DynamicPageHead
export function defineHeadContent<TLoader extends KiruLoader<unknown>>(
  metaOrFn:
    | RouteHeadMeta
    | ((ctx: LoaderContext, props: PageProps<TLoader>) => RouteHeadMeta)
): StaticPageHead | DynamicPageHead {
  if (typeof metaOrFn === "function") {
    const resolve: KiruPageHead["resolve"] = (ctx, pageProps) =>
      metaOrFn(ctx, pageProps as PageProps<TLoader>)
    return {
      __kiruPageHead: "dynamic",
      resolve,
    }
  }
  const meta = metaOrFn
  return {
    __kiruPageHead: "static",
    resolve: () => meta,
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

export function resolvePageHead(
  head: KiruPageHead,
  ctx: LoaderContext,
  pageProps?: PageProps<KiruLoader<unknown>>
): RouteHeadMeta {
  if (head.__kiruPageHead === "dynamic" && pageProps === undefined) {
    throw new Error(
      "[kiru/router] Dynamic page head requires loader props before resolve."
    )
  }
  return head.resolve(ctx, pageProps)
}

export function mergeRouteAndPageHead(
  routeHead: RouteHeadMeta,
  pageHead: RouteHeadMeta | undefined,
  params: Record<string, string>
): RouteHeadMeta {
  const base = resolveMetaTemplates(routeHead, params)
  if (!pageHead) return base
  return mergeRouteHead(base, pageHead)
}

export function isDynamicPageHead(head: KiruPageHead | undefined): boolean {
  return head?.__kiruPageHead === "dynamic"
}

export function isStaticPageHead(head: KiruPageHead | undefined): boolean {
  return head?.__kiruPageHead === "static"
}

/** Update `document.head` from route + page module exports (CSR / post-nav). */
export async function syncDocumentHeadForPage(
  match: { route: { head: RouteHeadMeta; component: () => Promise<unknown> }; params: Record<string, string>; pathname: string },
  loaderCtx: LoaderContext,
  pageProps?: PageProps<KiruLoader<unknown>>
): Promise<void> {
  const mod = await match.route.component()
  const pageHead = readPageHeadExport(mod)
  let pageHeadMeta: RouteHeadMeta | undefined
  if (pageHead) {
    pageHeadMeta = resolvePageHead(pageHead, loaderCtx, pageProps)
  }
  mergeAndSyncClientDocumentHead(match.route.head, pageHeadMeta, match.params, {
    pathname: match.pathname,
  })
}
