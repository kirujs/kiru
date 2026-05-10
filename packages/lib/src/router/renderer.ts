import { createElement, Fragment } from "../element.js"
import { renderToString } from "../renderToString.js"
import { renderToReadableStream } from "../ssr/server.js"
import { headlessRender } from "../headlessRender.js"
import { renderMode } from "../globals.js"
import { compileRouteTree, matchRoute } from "./manifest.js"
import {
  buildRoutedSubtree,
  loadNotFoundRouteTree,
  loadRouteTree,
} from "./routeTree.js"
import { resolveMetaTemplates, serializeDocumentHead } from "./meta.js"
import { compileRouteHtmlTemplate } from "./htmlTemplate.js"
import { RouterProvider, createStaticRouter } from "./csr.js"
import { createHeadCollector, withHeadCollector } from "./headContext.js"
import {
  RequestContextProvider,
  serializeRequestContextScript,
  type RequestContextValue,
} from "./requestContext.js"
import type {
  DocumentHead,
  RenderResult,
  StreamRenderResult,
  RouteManifest,
  RouteMatch,
  RouteModule,
  RouteTreeDefinition,
  CustomRequestContext,
} from "./types.js"
import { makeKiruContextToken } from "../remote/token.js"

export interface RenderRequestContext {
  headers?: HeadersInit
  method?: string
  context?: CustomRequestContext
}

export interface StreamRenderer {
  manifest: RouteManifest
  render: (
    url: string,
    context?: RenderRequestContext
  ) => Promise<StreamRenderResult | null>
}

export interface Renderer {
  manifest: RouteManifest
  render: (
    url: string,
    context?: RenderRequestContext
  ) => Promise<RenderResult | null>
}

export type CreateRendererOptions = {
  routes: RouteTreeDefinition | RouteManifest
  htmlTemplate?: string
  remoteFunctionSecret?: string
  /** When true, `createRenderer` returns a streaming renderer contract. */
  stream?: boolean
}

function engine(options: CreateRendererOptions & { stream: boolean }) {
  const { manifest, compiledTemplate, remoteFunctionSecret } =
    prepareRenderer(options)

  const renderCore = async (url: string, ctx?: RenderRequestContext) => {
    try {
      const prepared = await prepareAppForUrl(url, ctx, manifest)
      if (!prepared) return null

      const { app, routeMatch, requestContext } = prepared

      if (options.stream) {
        const { stream: innerStream, document } = routeMatch
          ? await renderStreamWithDocument(
              app,
              routeMatch,
              requestContext,
            )
          : {
              stream: renderToReadableStream(app),
              document: {
                headHtml: serializeRequestContextScript(
                  requestContext,
                ),
              },
            }

        if (remoteFunctionSecret)
          appendTokenToDocument(document, requestContext, remoteFunctionSecret)

        return {
          kind: "stream" as const,
          result: {
            status: routeMatch ? 200 : 404,
            headers: { ...DEFAULT_HEADERS },
            body:
              compiledTemplate !== null
                ? createTemplatedStream(
                    innerStream,
                    compiledTemplate.splitForStream(document.headHtml)
                  )
                : innerStream,
          },
        }
      }

      const { body, document } = routeMatch
        ? await renderStringWithDocument(
            app,
            routeMatch,
            requestContext,
          )
        : {
            body: renderToString(app),
            document: {
              headHtml: serializeRequestContextScript(
                requestContext,
              ),
            },
          }

      if (remoteFunctionSecret)
        appendTokenToDocument(document, requestContext, remoteFunctionSecret)

      const fullHead =
        document.headHtml +
        (document.headEndHtml ? `\n    ${document.headEndHtml}` : "")
      const fullBody = body + (document.bodyEndHtml ?? "")

      return {
        kind: "string" as const,
        result: {
          status: routeMatch ? 200 : 404,
          headers: DEFAULT_HEADERS,
          body:
            compiledTemplate !== null
              ? compiledTemplate.render(fullBody, fullHead)
              : fullBody,
        },
      }
    } catch (error) {
      const body = `<!DOCTYPE html><html><head><title>Error</title></head><body><pre>${String(
        error instanceof Error ? error.message : error
      ).replace(/</g, "&lt;")}</pre></body></html>`
      if (options.stream) {
        return {
          kind: "stream" as const,
          result: {
            status: 500,
            headers: { ...DEFAULT_HEADERS },
            body: new ReadableStream<string>({
              start(controller) {
                controller.enqueue(body)
                controller.close()
              },
            }),
          },
        }
      }
      return {
        kind: "string" as const,
        result: {
          status: 500,
          headers: DEFAULT_HEADERS,
          body,
        },
      }
    }
  }

  return { manifest, renderCore }
}

export function createRenderer(
  options: CreateRendererOptions & { stream?: false | undefined }
): Renderer
export function createRenderer(
  options: CreateRendererOptions & { stream: true }
): StreamRenderer
export function createRenderer(
  options: CreateRendererOptions
): Renderer | StreamRenderer {
  const stream = !!options.stream
  const { manifest, renderCore } = engine({ ...options, stream })

  if (stream) {
    return {
      manifest,
      async render(url, ctx) {
        const out = await renderCore(url, ctx)
        if (!out) return null
        return out.result as StreamRenderResult
      },
    }
  }

  return {
    manifest,
    async render(url, ctx) {
      const out = await renderCore(url, ctx)
      if (!out) return null
      return out.result as RenderResult
    },
  }
}

export function createStreamRenderer(
  options: Omit<CreateRendererOptions, "stream">
): StreamRenderer {
  return createRenderer({ ...options, stream: true }) as StreamRenderer
}

/**
 * Single-pass render: produces the body string and resolves document head
 * simultaneously. Used by the string renderer and SSG, where the head does
 * not need to be known before the body starts.
 */
async function renderStringWithDocument(
  app: JSX.Element,
  match: RouteMatch,
  requestContext: RequestContextValue,
): Promise<{ body: string; document: DocumentHead }> {
  const baseMeta = resolveMetaTemplates(match.route.head, match.params)
  const collector = createHeadCollector(baseMeta)

  let body = ""
  withHeadCollector(collector, () => {
    const prev = renderMode.current
    renderMode.current = "stream"
    headlessRender(
      {
        write(chunk) {
          body += chunk
        },
      },
      Fragment({ children: app })
    )
    renderMode.current = prev
  })

  const resolvedMeta = await collector.resolve()
  const ctxScript = serializeRequestContextScript(requestContext)
  return {
    body,
    document: {
      headHtml:
        serializeDocumentHead(resolvedMeta, { pathname: match.pathname }) +
        (ctxScript ? `\n    ${ctxScript}` : ""),
      title: resolvedMeta.title,
    },
  }
}

export { buildRoutedSubtree, loadNotFoundRouteTree, loadRouteTree } from "./routeTree.js"

function buildAppElement(
  pathname: string,
  params: Record<string, string>,
  layoutModules: Array<RouteModule | null>,
  routeModule: RouteModule,
  manifest: RouteManifest,
  requestContext: RequestContextValue
) {
  const staticRouter = createStaticRouter({
    manifest,
    pathname,
    query: {},
    hash: "",
  })
  staticRouter.params.value = params
  const subtree = buildRoutedSubtree(layoutModules, routeModule)
  return createElement(RequestContextProvider, {
    value: requestContext,
    children: createElement(RouterProvider, {
      router: staticRouter,
      children: subtree,
    }),
  })
}

/** Shared SSG / SSR string render for a matched route. */
export async function renderMatchToStaticHtml(
  manifest: RouteManifest,
  match: RouteMatch,
): Promise<{ body: string; document: DocumentHead }> {
  const { layoutModules, routeModule } = await loadRouteTree(match)
  const app = buildAppElement(
    match.pathname,
    match.params,
    layoutModules,
    routeModule,
    manifest,
    null
  )
  return renderStringWithDocument(
    app,
    match,
    null,
  )
}

const DEFAULT_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
}

type PreparedApp = {
  app: JSX.Element
  routeMatch: RouteMatch | null
  requestContext: RequestContextValue
}

async function prepareAppForUrl(
  url: string,
  ctx: RenderRequestContext | undefined,
  manifest: RouteManifest
): Promise<PreparedApp | null> {
  const pathname = toPathname(url)
  const routeMatch = matchRoute(manifest, pathname)
  const notFoundTree = !routeMatch
    ? await loadNotFoundRouteTree(manifest, pathname)
    : null
  if (!routeMatch && !notFoundTree) return null
  const requestContext = (ctx?.context ?? null) as RequestContextValue

  if (routeMatch) {
    const { layoutModules, routeModule } = await loadRouteTree(routeMatch)
    const app = buildAppElement(
      routeMatch.pathname,
      routeMatch.params,
      layoutModules,
      routeModule,
      manifest,
      requestContext
    )
    return {
      app,
      routeMatch,
      requestContext,
    }
  }

  const { layoutModules, routeModule } = notFoundTree!
  const app = buildAppElement(
    pathname,
    {},
    layoutModules,
    routeModule,
    manifest,
    requestContext
  )
  return {
    app,
    routeMatch: null,
    requestContext,
  }
}

/**
 * Streaming counterpart to renderStringWithDocument: starts the readable
 * stream inside the head collector so meta tags are captured, then resolves
 * the document head before returning.
 */
async function renderStreamWithDocument(
  app: JSX.Element,
  match: RouteMatch,
  requestContext: RequestContextValue,
): Promise<{ stream: ReadableStream<string>; document: DocumentHead }> {
  const { route, params, pathname } = match
  const collector = createHeadCollector(
    resolveMetaTemplates(route.head, params)
  )
  const stream = withHeadCollector(collector, () => renderToReadableStream(app))
  const resolvedMeta = await collector.resolve()
  const ctxScript = serializeRequestContextScript(requestContext)
  return {
    stream,
    document: {
      headHtml:
        serializeDocumentHead(resolvedMeta, { pathname }) +
        (ctxScript ? `\n    ${ctxScript}` : ""),
      title: resolvedMeta.title,
    },
  }
}

function prepareRenderer(options: CreateRendererOptions) {
  const { routes, htmlTemplate, remoteFunctionSecret } = options
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const compiledTemplate =
    htmlTemplate !== undefined ? compileRouteHtmlTemplate(htmlTemplate) : null
  return { manifest, compiledTemplate, remoteFunctionSecret }
}

function appendTokenToDocument(
  document: DocumentHead,
  requestContext: RequestContextValue,
  secret: string
): void {
  if (!requestContext) return
  const token = makeKiruContextToken(
    requestContext as Record<string, unknown>,
    secret
  )
  document.headHtml += `\n    <script type="application/json" k-request-token>${token}</script>`
}

function createTemplatedStream(
  source: ReadableStream<string>,
  template: { prefix: string; suffix: string }
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      controller.enqueue(template.prefix)
      const reader = source.getReader()
      try {
        while (true) {
          const next = await reader.read()
          if (next.done) break
          controller.enqueue(next.value)
        }
        controller.enqueue(template.suffix)
        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
  })
}

function toPathname(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname
  } catch {
    return url
  }
}
