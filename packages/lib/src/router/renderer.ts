import { createElement, Fragment } from "../element.js"
import { renderToString } from "../renderToString.js"
import { renderToReadableStream } from "../ssr/server.js"
import { headlessRender } from "../headlessRender.js"
import { renderMode } from "../globals.js"
import {
  compileRouteTree,
  matchRoute,
  resolveNotFoundScopes,
} from "./manifest.js"
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

export function createRenderer(options: CreateRendererOptions): Renderer {
  const { manifest, compiledTemplate, remoteFunctionSecret } =
    prepareRenderer(options)

  return {
    manifest,
    async render(url, ctx) {
      const result = await createAppForUrl(url, ctx, manifest)
      if (!result) return null
      const { app, routeMatch, requestContext } = result

      const { body, document } = routeMatch
        ? await renderStringWithDocument(app, routeMatch, requestContext)
        : {
            body: renderToString(app),
            document: {
              headHtml: serializeRequestContextScript(requestContext),
            },
          }

      if (remoteFunctionSecret)
        appendTokenToDocument(document, requestContext, remoteFunctionSecret)

      return {
        status: routeMatch ? 200 : 404,
        headers: DEFAULT_HEADERS,
        body:
          compiledTemplate !== null
            ? compiledTemplate.render(body, document.headHtml)
            : body,
      }
    },
  }
}

export function createStreamRenderer(
  options: CreateRendererOptions
): StreamRenderer {
  const { manifest, compiledTemplate, remoteFunctionSecret } =
    prepareRenderer(options)

  return {
    manifest,
    async render(url, ctx) {
      const result = await createAppForUrl(url, ctx, manifest)
      if (!result) return null
      const { app, routeMatch, requestContext } = result

      const { stream: innerStream, document } = routeMatch
        ? await renderStreamWithDocument(app, routeMatch, requestContext)
        : {
            stream: renderToReadableStream(app),
            document: {
              headHtml: serializeRequestContextScript(requestContext),
            },
          }

      if (remoteFunctionSecret)
        appendTokenToDocument(document, requestContext, remoteFunctionSecret)

      return {
        status: routeMatch ? 200 : 404,
        headers: { ...DEFAULT_HEADERS, "transfer-encoding": "chunked" },
        body:
          compiledTemplate !== null
            ? createTemplatedStream(
                innerStream,
                compiledTemplate.splitForStream(document.headHtml)
              )
            : innerStream,
      }
    },
  }
}

/**
 * Single-pass render: produces the body string and resolves document head
 * simultaneously. Used by the string renderer and SSG, where the head does
 * not need to be known before the body starts.
 */
async function renderStringWithDocument(
  app: JSX.Element,
  match: RouteMatch,
  requestContext: RequestContextValue
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
  return {
    body,
    document: {
      headHtml:
        serializeDocumentHead(resolvedMeta, { pathname: match.pathname }) +
        `\n    ${serializeRequestContextScript(requestContext)}`,
      title: resolvedMeta.title,
    },
  }
}

export async function loadRouteTree(match: RouteMatch): Promise<{
  layoutModules: Array<RouteModule | null>
  routeModule: RouteModule
}> {
  const layoutModules = await Promise.all(
    match.route.scopes.map((scope) => scope.layout?.() ?? null)
  )
  const routeModule = await match.route.component()
  return { layoutModules, routeModule }
}

export async function loadNotFoundRouteTree(
  manifest: RouteManifest,
  pathname: string
): Promise<{
  layoutModules: Array<RouteModule | null>
  routeModule: RouteModule
} | null> {
  const scopes = resolveNotFoundScopes(manifest, pathname)
  if (!scopes) return null
  const notFoundScope = [...scopes].reverse().find((scope) => !!scope.notFound)
  if (!notFoundScope?.notFound) return null
  const [routeModule, layoutModules] = await Promise.all([
    notFoundScope.notFound(),
    Promise.all(scopes.map((scope) => scope.layout?.() ?? null)),
  ])
  return { layoutModules, routeModule }
}

/** Layout stack + page only (no RouterProvider). Matches SSR/SSG body HTML. */
export function buildRoutedSubtree(
  layoutModules: Array<RouteModule | null>,
  routeModule: RouteModule
) {
  let app = createElement(asComponent(routeModule), {})
  for (const module of layoutModules.slice().reverse()) {
    if (!module) continue
    app = createElement(asComponent(module), { children: app })
  }
  return app
}

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
  match: RouteMatch
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
  return renderStringWithDocument(app, match, null)
}

const DEFAULT_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
}

export interface CreateRendererOptions {
  /**
   * The routes to render.
   */
  routes: RouteTreeDefinition | RouteManifest
  /**
   * The HTML template to use for the rendered page.
   */
  htmlTemplate?: string
  /**
   * The secret to use for the remote function token.
   */
  remoteFunctionSecret?: string
}

async function createAppForUrl(
  url: string,
  ctx: RenderRequestContext | undefined,
  manifest: RouteManifest
) {
  const pathname = toPathname(url)
  const routeMatch = matchRoute(manifest, pathname)
  const notFoundTree = !routeMatch
    ? await loadNotFoundRouteTree(manifest, pathname)
    : null
  if (!routeMatch && !notFoundTree) return null
  const { layoutModules, routeModule } = routeMatch
    ? await loadRouteTree(routeMatch)
    : notFoundTree!
  const requestContext = (ctx?.context ?? {}) as RequestContextValue
  const app = buildAppElement(
    routeMatch?.pathname ?? pathname,
    routeMatch?.params ?? {},
    layoutModules,
    routeModule,
    manifest,
    requestContext
  )
  return { app, routeMatch, requestContext }
}

/**
 * Streaming counterpart to renderStringWithDocument: starts the readable
 * stream inside the head collector so meta tags are captured, then resolves
 * the document head before returning.
 */
async function renderStreamWithDocument(
  app: JSX.Element,
  match: RouteMatch,
  requestContext: RequestContextValue
): Promise<{ stream: ReadableStream<string>; document: DocumentHead }> {
  const { route, params, pathname } = match
  const collector = createHeadCollector(
    resolveMetaTemplates(route.head, params)
  )
  const stream = withHeadCollector(collector, () => renderToReadableStream(app))
  const resolvedMeta = await collector.resolve()
  return {
    stream,
    document: {
      headHtml:
        serializeDocumentHead(resolvedMeta, { pathname }) +
        `\n    ${serializeRequestContextScript(requestContext)}`,
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

function asComponent(module: RouteModule): Kiru.FC<any> {
  return typeof module === "function" ? module : module.default
}

function toPathname(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname
  } catch {
    return url
  }
}
