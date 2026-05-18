import {
  hydratePrerenderedHtmlForRequest,
} from "kiru/router"
import type {
  CustomRequestContext,
  RenderResult,
  StreamRenderResult,
} from "kiru/router"
import { readRouteISRExport, getISRRevalidate } from "kiru/router"
import { cachePolicyToHeaders, mergeResponseHeaders } from "kiru/router"

export type ImmutablePrerenderHit =
  | { kind: "stream"; result: StreamRenderResult }
  | { kind: "string"; result: RenderResult }

export type TryServeImmutablePrerenderOptions = {
  stream: boolean
  getAsset: (pathname: string) => Promise<string | null>
  loadPageModule: (pathname: string) => Promise<unknown>
  getStaticPathSet: () => Promise<ReadonlySet<string>>
  actionsSecret?: string
}

/**
 * Serve build-time HTML for immutable routes only (revalidate: false).
 * No time-based ISR or tag revalidation on Workers.
 */
export async function tryServeImmutablePrerender(
  request: Request,
  url: string,
  options: TryServeImmutablePrerenderOptions,
  ctx?: { context?: CustomRequestContext }
): Promise<ImmutablePrerenderHit | null> {
  if (request.method !== "GET") return null

  const pathname = new URL(url, "http://localhost").pathname
  const staticPaths = await options.getStaticPathSet()
  if (!staticPaths.has(pathname)) return null

  const pageMod = await options.loadPageModule(pathname)
  const isr = readRouteISRExport(pageMod)
  if (isr?.dynamic === "force-dynamic") return null

  const revalidate = getISRRevalidate(isr)
  if (revalidate !== false && revalidate !== undefined) {
    return null
  }

  const html = await options.getAsset(pathname)
  if (!html) return null

  const requestContext = (ctx?.context ?? null) as CustomRequestContext
  const hydrated = await hydratePrerenderedHtmlForRequest(
    html,
    requestContext,
    options.actionsSecret,
    "cloudflare"
  )

  const cacheHeaders = cachePolicyToHeaders(undefined, true, undefined)
  const headers = mergeResponseHeaders(
    { "content-type": "text/html; charset=utf-8" },
    cacheHeaders
  )

  if (options.stream) {
    return {
      kind: "stream",
      result: {
        status: 200,
        headers,
        body: new ReadableStream<string>({
          start(controller) {
            controller.enqueue(hydrated)
            controller.close()
          },
        }),
      },
    }
  }

  return {
    kind: "string",
    result: { status: 200, headers, body: hydrated },
  }
}
