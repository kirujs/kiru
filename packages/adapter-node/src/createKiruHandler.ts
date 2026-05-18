import {
  createRenderer,
  createImageOptimizerIfRuntime,
  type CreateRendererOptions,
  type Renderer,
  type StreamRenderer,
} from "kiru/router"
import type { ImageConfig } from "kiru/image"
import type { KiruDeployTarget } from "@kirujs/runtime"
import { resolveStatic } from "./resolveStatic.js"
import { composeFetch } from "./middleware.js"
import { serveStaticFile } from "./serveStaticFile.js"
import type {
  GetRequestContext,
  KiruFetch,
  KiruHandler,
  KiruMiddleware,
} from "./types.js"

export type CreateKiruHandlerOptions = Omit<
  CreateRendererOptions,
  "htmlTemplate" | "prerenderedHtmlDir" | "deployTarget"
> & {
  /** @default "node" */
  deployTarget?: Extract<KiruDeployTarget, "node" | "bun">
  importMetaUrl: string
  dev?: boolean
  clientDir?: string
  /** Production hybrid ISR directory; defaults to resolved clientDir. Pass `false` to disable. */
  prerenderedHtmlDir?: string | false
  image?: {
    config: ImageConfig
    /** Instance from `import sharp from "sharp"` (sharp’s callable export). */
    sharp?: typeof import("sharp")
    cacheDir?: string
  }
  /** When true (default in production), serve static files from clientDir before SSR. */
  serveStaticAssets?: boolean
  /** Per-request context passed to `renderer.render`. */
  getRequestContext?: GetRequestContext
  /** Extra middleware (outermost first) around the built-in static + SSR stack. */
  middleware?: KiruMiddleware[]
}

function createSsrFetch(
  renderer: Renderer | StreamRenderer,
  getRequestContext?: GetRequestContext
): KiruFetch {
  return async (request) => {
    const context = getRequestContext
      ? await getRequestContext(request)
      : undefined
    const rendered = await renderer.render(request, { context })
    if (!rendered) {
      return new Response("Not found", { status: 404 })
    }
    const { status, headers, body } = rendered
    return new Response(body, { status, headers })
  }
}

function createStaticAssetsMiddleware(options: {
  clientDir: string
  imageHandler: ((request: Request) => Promise<Response | null>) | null
  imagePath?: string
}): KiruMiddleware {
  const { clientDir, imageHandler, imagePath } = options
  return async (request, next) => {
    const pathname = new URL(request.url).pathname

    if (imageHandler && imagePath && pathname === imagePath) {
      const imageRes = await imageHandler(request)
      if (imageRes) return imageRes
      return new Response("Not Found", { status: 404 })
    }

    const staticRes = await serveStaticFile(clientDir, pathname)
    if (staticRes) return staticRes

    return next()
  }
}

/**
 * Web-standard `fetch` handler for Kiru SSR (+ optional static assets and ISR).
 * Use with Node `serveKiruNode`, `Bun.serve`, or any framework that accepts `Request` → `Response`.
 */
export function createKiruHandler(
  options: CreateKiruHandlerOptions
): KiruHandler {
  const isProd =
    typeof options.dev === "boolean"
      ? !options.dev
      : process.env.NODE_ENV === "production"
  const paths = resolveStatic(options.importMetaUrl, {
    dev: !isProd,
    clientDir: options.clientDir,
  })

  const prerenderedHtmlDir =
    options.prerenderedHtmlDir === false
      ? undefined
      : options.prerenderedHtmlDir ?? (isProd ? paths.clientDir : undefined)

  const {
    getRequestContext,
    image,
    serveStaticAssets = isProd,
    stream,
    deployTarget = "node",
    middleware = [],
    ...rendererOpts
  } = options

  const rendererCommon = {
    ...rendererOpts,
    deployTarget,
    htmlTemplate: paths.htmlTemplate,
    prerenderedHtmlDir,
  }

  const renderer = stream
    ? createRenderer({ ...rendererCommon, stream: true })
    : createRenderer(rendererCommon)

  const imageHandler =
    serveStaticAssets && isProd && image
      ? createImageOptimizerIfRuntime({
          root: paths.clientDir,
          config: image.config,
          sharp: image.sharp,
          cacheDir: image.cacheDir ?? `${paths.clientDir}/.kiru-image-cache`,
        })
      : null

  const layers: KiruMiddleware[] = [...middleware]
  if (serveStaticAssets && isProd) {
    layers.push(
      createStaticAssetsMiddleware({
        clientDir: paths.clientDir,
        imageHandler,
        imagePath: image?.config.path,
      })
    )
  }

  const fetch = composeFetch(createSsrFetch(renderer, getRequestContext), ...layers)

  return {
    fetch,
    renderer,
    clientDir: paths.clientDir,
    htmlTemplate: paths.htmlTemplate,
  }
}
