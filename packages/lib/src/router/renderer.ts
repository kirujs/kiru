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

function asComponent(module: RouteModule): Kiru.FC<any> {
  return typeof module === "function" ? module : module.default
}

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

function toPathname(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname
  } catch {
    return url
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
  routes: RouteTreeDefinition | RouteManifest
  htmlTemplate?: string
}

async function createAppForUrl(
  url: string,
  ctx: RenderRequestContext | undefined,
  manifest: RouteManifest
) {
  const pathname = toPathname(url)
  const route = matchRoute(manifest, pathname)
  const notFoundTree = !route
    ? await loadNotFoundRouteTree(manifest, pathname)
    : null
  if (!route && !notFoundTree) return null
  const { layoutModules, routeModule } = route
    ? await loadRouteTree(route)
    : notFoundTree!
  const requestContext = (ctx?.context ?? null) as RequestContextValue
  const app = buildAppElement(
    route?.pathname ?? pathname,
    route?.params ?? {},
    layoutModules,
    routeModule,
    manifest,
    requestContext
  )
  return { app, route, requestContext }
}

export function createRenderer(options: CreateRendererOptions): Renderer {
  const { routes, htmlTemplate } = options
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const compiledTemplate =
    htmlTemplate !== undefined ? compileRouteHtmlTemplate(htmlTemplate) : null

  return {
    manifest,
    async render(url, ctx) {
      const result = await createAppForUrl(url, ctx, manifest)
      if (!result) return null
      const { app, route, requestContext } = result
      const { body, document } = route
        ? await renderStringWithDocument(app, route, requestContext)
        : {
            body: renderToString(app),
            document: {
              headHtml: serializeRequestContextScript(requestContext),
            },
          }
      const html =
        compiledTemplate !== null
          ? compiledTemplate.render(body, document.headHtml)
          : body

      return {
        status: route ? 200 : 404,
        headers: DEFAULT_HEADERS,
        body: html,
        document,
      }
    },
  }
}

export function createStreamRenderer(
  options: CreateRendererOptions
): StreamRenderer {
  const { routes, htmlTemplate } = options
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const compiledTemplate =
    htmlTemplate !== undefined ? compileRouteHtmlTemplate(htmlTemplate) : null

  return {
    manifest,
    async render(url, ctx) {
      const result = await createAppForUrl(url, ctx, manifest)
      if (!result) return null
      const { app, route, requestContext } = result
      let document: DocumentHead
      let innerStream: ReadableStream<string>
      if (route) {
        const collector = createHeadCollector(
          resolveMetaTemplates(route.route.head, route.params)
        )
        innerStream = withHeadCollector(collector, () =>
          renderToReadableStream(app)
        )
        const resolvedMeta = await collector.resolve()
        document = {
          headHtml:
            serializeDocumentHead(resolvedMeta, { pathname: route.pathname }) +
            `\n    ${serializeRequestContextScript(requestContext)}`,
          title: resolvedMeta.title,
        }
      } else {
        document = { headHtml: serializeRequestContextScript(requestContext) }
        innerStream = renderToReadableStream(app)
      }
      const streamBody =
        compiledTemplate !== null
          ? createTemplatedStream(
              innerStream,
              compiledTemplate.splitForStream(document.headHtml)
            )
          : innerStream
      return {
        status: route ? 200 : 404,
        headers: { ...DEFAULT_HEADERS, "transfer-encoding": "chunked" },
        body: streamBody,
        document,
      }
    },
  }
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
