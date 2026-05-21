import {
  hydratePrerenderedHtmlForRequest,
} from "./prerenderedHtml.js"
import { resolvePathPolicy, type RouterPathPolicy } from "./pathPolicy.js"
import type {
  CustomRequestContext,
  RenderResult,
  StreamRenderResult,
} from "./types.js"
import {
  diskPrerenderCache,
  type PrerenderCacheStore,
  isPrerenderEntryFresh,
  isPrerenderEntryStale,
  runPrerenderRegenSingleFlight,
} from "./prerenderCache.js"
import { cachePolicyToHeaders } from "./routeResponse.js"
import { mergeResponseHeaders } from "./routeResponse.js"
import {
  resolveLocaleForPrerenderRequest,
  type I18nLocaleRouting,
} from "./i18n/index.js"

export type PrerenderRenderContext = {
  context?: CustomRequestContext
}

export type PrerenderServeHit =
  | { kind: "stream"; result: StreamRenderResult }
  | { kind: "string"; result: RenderResult }

export type TryServePrerenderedOptions = {
  prerenderedHtmlDir?: string
  prerenderCache?: PrerenderCacheStore
  stream: boolean
  pathPolicy?: RouterPathPolicy
  getStaticPathSet: () => Promise<ReadonlySet<string>>
  localeRouting?: I18nLocaleRouting
  actionsSecret: string
  deployTarget?: import("@kirujs/runtime").KiruDeployTarget
  /** When entry is stale, regenerate HTML in the background (SWR). */
  onRegenerate?: (pathname: string) => Promise<void>
}

function buildPrerenderResponse(
  hydrated: string,
  stream: boolean,
  headers: Record<string, string>
): PrerenderServeHit {
  if (stream) {
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
    result: {
      status: 200,
      headers,
      body: hydrated,
    },
  }
}

export async function tryServePrerenderedFromDisk(
  requestOrUrl: Request | string,
  url: string,
  options: TryServePrerenderedOptions,
  ctx?: PrerenderRenderContext
): Promise<PrerenderServeHit | null> {
  if (
    typeof process === "undefined" ||
    process.env.NODE_ENV !== "production"
  ) {
    return null
  }

  const allowPrerenderRead =
    typeof requestOrUrl === "string" || requestOrUrl.method === "GET"
  if (!allowPrerenderRead) return null

  const pathPolicy = resolvePathPolicy(options.pathPolicy)
  const parsed = new URL(url, "http://localhost")
  const pathname = parsed.pathname
  const staticPaths = await options.getStaticPathSet()
  if (!staticPaths.has(pathname)) return null

  const localeRouting = options.localeRouting
  let cacheLookupKey = pathname
  if (localeRouting?.domains.length) {
    const resolved = resolveLocaleForPrerenderRequest(
      parsed.host,
      pathname,
      localeRouting,
      pathPolicy
    )
    if (resolved) cacheLookupKey = resolved.storageKey
  }

  const store =
    options.prerenderCache ??
    (options.prerenderedHtmlDir
      ? diskPrerenderCache({
          clientDir: options.prerenderedHtmlDir,
          pathPolicy,
          staticPaths,
        })
      : null)

  if (!store) return null

  const entry = store.get(cacheLookupKey)
  if (!entry) return null

  if (!isPrerenderEntryFresh(entry) && isPrerenderEntryStale(entry)) {
    if (options.onRegenerate) {
      void runPrerenderRegenSingleFlight(pathname, () =>
        options.onRegenerate!(pathname)
      )
    }
    if (!entry.html) return null
  } else if (!isPrerenderEntryFresh(entry) && !isPrerenderEntryStale(entry)) {
    return null
  }

  const requestContext = (ctx?.context ?? null) as CustomRequestContext
  const hydrated = await hydratePrerenderedHtmlForRequest(
    entry.html,
    requestContext,
    options.actionsSecret,
    options.deployTarget ?? "node"
  )

  const cacheHeaders = cachePolicyToHeaders(
    undefined,
    entry.revalidate === false,
    typeof entry.revalidate === "number" ? entry.revalidate : undefined
  )
  const headers = mergeResponseHeaders(
    { "content-type": "text/html; charset=utf-8" },
    cacheHeaders
  )

  return buildPrerenderResponse(hydrated, options.stream, headers)
}
