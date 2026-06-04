import { createRenderer, type CreateRendererOptions } from "kiru/router"
import type { CustomRequestContext } from "kiru/router"
import { matchRoute, generatePublicStaticPaths, fetchHtmlAsset } from "kiru/router"
import { resolvePathPolicy } from "kiru/router"
import { toFetchHandler, type KiruHandle } from "@kirujs/adapter-contract"
import { tryServeImmutablePrerender } from "./serveImmutablePrerender.js"
import { isStaticAssetPathname } from "@kirujs/runtime"

export type GetAssetFn = (
  /** URL pathname, e.g. `/docs` or `/docs.html` */
  pathname: string
) => Promise<string | null>

export type CreateKiruWorkerHandlerOptions = Omit<
  CreateRendererOptions,
  "htmlTemplate" | "prerenderedHtmlDir" | "prerenderCache" | "deployTarget"
> & {
  htmlTemplate: string
  /**
   * Read prerendered HTML from Workers Assets / KV / R2.
   * Receives pathname; return file contents or null.
   */
  getAsset: GetAssetFn
  getRequestContext?: (
    request: Request
  ) => CustomRequestContext | Promise<CustomRequestContext>
  /**
   * Forward hashed bundles and other static files to the Assets binding.
   * Required when `run_worker_first = true` in wrangler.toml.
   */
  assetFetch?: (request: Request) => Promise<Response>
  /** Web `fetch` when {@link KiruHandle} returns `null`. Default: 404. */
  notFound?: import("@kirujs/adapter-contract").ToFetchHandlerOptions["notFound"]
}

export type KiruWorkerHandler = (
  request: Request,
  env?: unknown,
  ctx?: ExecutionContext
) => Promise<Response>

function renderResultToResponse(rendered: {
  status: number
  headers: Record<string, string>
  body: string | ReadableStream
}): Response {
  return new Response(rendered.body as BodyInit, {
    status: rendered.status,
    headers: rendered.headers,
  })
}

/**
 * Worker {@link KiruHandle} — SSR + immutable static HTML only (no ISR).
 * `null` when no route match; use your framework layer for 404 / fallthrough.
 */
export function createKiruWorkerHandle(
  options: CreateKiruWorkerHandlerOptions
): KiruHandle {
  const {
    getAsset,
    getRequestContext,
    htmlTemplate,
    stream,
    assetFetch,
    ...rendererOpts
  } = options
  const pathPolicy = resolvePathPolicy(rendererOpts.pathPolicy)

  const rendererCommon = {
    ...rendererOpts,
    deployTarget: "cloudflare" as const,
    htmlTemplate,
  }
  const renderer = stream
    ? createRenderer({ ...rendererCommon, stream: true })
    : createRenderer(rendererCommon)

  const getStaticPathSet = () =>
    generatePublicStaticPaths(
      renderer.manifest,
      pathPolicy,
      undefined,
      undefined
    ).then((paths) => new Set(paths))

  const loadPageModule = async (pathname: string) => {
    const match = matchRoute(renderer.manifest, pathname, pathPolicy)
    if (!match) return {}
    return match.route.component()
  }

  return async (request: Request) => {
    const url = new URL(request.url)
    if (assetFetch && isStaticAssetPathname(url.pathname)) {
      return assetFetch(request)
    }

    const context = getRequestContext
      ? await getRequestContext(request)
      : undefined

    const prerendered = await tryServeImmutablePrerender(
      request,
      request.url,
      {
        stream: stream === true,
        getAsset: (pathname) => fetchHtmlAsset(getAsset, pathname),
        loadPageModule,
        getStaticPathSet,
        actionsSecret: rendererOpts.actions?.secret,
      },
      { context }
    )

    if (prerendered) {
      return renderResultToResponse(prerendered.result)
    }

    const rendered = await renderer.render(request, { context })
    if (!rendered) {
      return null
    }
    return renderResultToResponse(rendered)
  }
}

/**
 * Cloudflare Worker `fetch` handler (`null` → 404 by default).
 */
export function createKiruWorkerHandler(
  options: CreateKiruWorkerHandlerOptions
): KiruWorkerHandler {
  const handle = createKiruWorkerHandle(options)
  const fetch = toFetchHandler(handle, { notFound: options.notFound })
  return (request) => fetch(request)
}

/**
 * Wrap a Workers Assets binding as {@link GetAssetFn}.
 */
export function assetsBindingToGetAsset(
  fetchAsset: (request: Request) => Promise<Response>
): GetAssetFn {
  return async (pathname) => {
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`
    const filePath =
      path.endsWith(".html") || path.includes(".")
        ? path
        : `${path.replace(/\/$/, "") || ""}/index.html`.replace(/^\//, "/")
    const url = `https://assets.local${filePath}`
    const res = await fetchAsset(new Request(url))
    if (!res.ok) return null
    return res.text()
  }
}

export type WranglerSnippetOptions = {
  name: string
  main?: string
  assetsDirectory?: string
}

/** Minimal wrangler.toml fragment for documentation / codegen. */
export function generateWranglerSnippet(
  options: WranglerSnippetOptions
): string {
  const main = options.main ?? "dist/server/index.js"
  const assets = options.assetsDirectory ?? "dist/client"
  return `# Generated by @kirujs/adapter-cloudflare — adjust bindings as needed
name = "${options.name}"
main = "${main}"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "${assets}"
binding = "ASSETS"
run_worker_first = true
`
}
