import {
  hydratePrerenderedHtmlForRequest,
  tryReadPrerenderedHtml,
} from "./prerenderedHtml.js"
import { resolvePathPolicy, type RouterPathPolicy } from "./pathPolicy.js"
import type {
  CustomRequestContext,
  RenderResult,
  StreamRenderResult,
} from "./types.js"

export type PrerenderRenderContext = {
  context?: CustomRequestContext
}

const PRERENDER_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
}

export type PrerenderServeHit =
  | { kind: "stream"; result: StreamRenderResult }
  | { kind: "string"; result: RenderResult }

export async function tryServePrerenderedFromDisk(
  requestOrUrl: Request | string,
  url: string,
  options: {
    prerenderedHtmlDir: string
    stream: boolean
    pathPolicy?: RouterPathPolicy
    getStaticPathSet: () => Promise<ReadonlySet<string>>
    actionsSecret: string
  },
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
  const pathname = new URL(url, "http://localhost").pathname
  const html = tryReadPrerenderedHtml(options.prerenderedHtmlDir, pathname, {
    staticPaths: await options.getStaticPathSet(),
    pathPolicy,
  })
  if (!html) return null

  const requestContext = (ctx?.context ?? null) as CustomRequestContext
  const hydrated = hydratePrerenderedHtmlForRequest(
    html,
    requestContext,
    options.actionsSecret
  )

  if (options.stream) {
    return {
      kind: "stream",
      result: {
        status: 200,
        headers: { ...PRERENDER_HEADERS },
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
      headers: PRERENDER_HEADERS,
      body: hydrated,
    },
  }
}
