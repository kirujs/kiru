import {
  createRenderer,
  createImageOptimizerIfRuntime,
  type CreateRendererOptions,
  type Renderer,
  type StreamRenderer,
} from "kiru/router"
import type { ImageConfig } from "kiru/image"
import type { KiruDeployTarget } from "@kirujs/runtime"
import {
  composeRespond,
  toFetchHandler,
  webResponseToKiru,
  type KiruHandle,
  type KiruRespondMiddleware,
  type KiruResponder,
  type KiruResponse,
} from "@kirujs/adapter-contract"
import { resolveStatic } from "./resolveStatic.js"
import { serveStaticFile } from "./serveStaticFile.js"
import type { GetRequestContext } from "./types.js"

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
  middleware?: KiruRespondMiddleware[]
  /** Web `fetch` when `handle` returns `null`. Default: 404. */
  notFound?: import("@kirujs/adapter-contract").ToFetchHandlerOptions["notFound"]
}

function renderResultToKiru(
  rendered: { status: number; headers: Record<string, string>; body: string | ReadableStream }
): KiruResponse {
  return {
    status: rendered.status,
    headers: rendered.headers,
    body: rendered.body,
  }
}

function createSsrHandle(
  renderer: Renderer | StreamRenderer,
  getRequestContext?: GetRequestContext
): KiruHandle {
  return async (request) => {
    const context = getRequestContext
      ? await getRequestContext(request)
      : undefined
    const rendered = await renderer.render(request, { context })
    if (!rendered) {
      return null
    }
    return renderResultToKiru(rendered)
  }
}

function createStaticAssetsMiddleware(options: {
  clientDir: string
  imageHandler: ((request: Request) => Promise<Response | null>) | null
  imagePath?: string
}): KiruRespondMiddleware {
  const { clientDir, imageHandler, imagePath } = options
  return async (request, next) => {
    const pathname = new URL(request.url).pathname

    if (imageHandler && imagePath && pathname === imagePath) {
      const imageRes = await imageHandler(request)
      if (imageRes) {
        return webResponseToKiru(imageRes)
      }
      return { status: 404, headers: {}, body: "Not Found" }
    }

    const staticRes = await serveStaticFile(clientDir, pathname)
    if (staticRes) {
      return webResponseToKiru(staticRes)
    }

    return next()
  }
}

/**
 * Kiru SSR (+ optional static assets and ISR).
 * {@link KiruResponder.handle} returns {@link KiruResponse} or `null`; wire HTTP in your framework.
 */
export function createKiruResponder(
  options: CreateKiruHandlerOptions
): KiruResponder {
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
    notFound,
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

  const layers: KiruRespondMiddleware[] = [...middleware]
  if (serveStaticAssets && isProd) {
    layers.push(
      createStaticAssetsMiddleware({
        clientDir: paths.clientDir,
        imageHandler,
        imagePath: image?.config.path,
      })
    )
  }

  const handle = composeRespond(
    createSsrHandle(renderer, getRequestContext),
    ...layers
  )

  return {
    handle,
    fetch: toFetchHandler(handle, { notFound }),
    renderer,
    clientDir: paths.clientDir,
    htmlTemplate: paths.htmlTemplate,
  }
}

/**
 * Same as {@link createKiruResponder} — convenience when you only need Web `fetch`.
 */
export function createKiruHandler(
  options: CreateKiruHandlerOptions
): KiruResponder {
  return createKiruResponder(options)
}
