import { createElement } from "../element.js"
import { renderToString } from "../renderToString.js"
import { renderToReadableStream } from "../ssr/server.js"
import { headlessRender } from "../headlessRender.js"
import { renderMode } from "../globals.js"
import { compileRouteTree, matchRoute } from "./manifest.js"
import { resolveMetaTemplates, serializeDocumentHead } from "./meta.js"
import { compileRouteHtmlTemplate } from "./htmlTemplate.js"
import { RouterProvider, createStaticRouter } from "./csr.js"
import { createHeadCollector, withHeadCollector } from "./headContext.js"
import type {
  DocumentHead,
  RenderResult,
  StreamRenderResult,
  RouteManifest,
  RouteMatch,
  RouteModule,
  RouteTreeDefinition,
} from "./types.js"

function asComponent(module: RouteModule): Kiru.FC<any> {
  return typeof module === "function" ? module : module.default
}

export interface RenderRequestContext {
  headers?: HeadersInit
  method?: string
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

async function documentFromMatch(
  app: JSX.Element,
  match: RouteMatch
): Promise<DocumentHead> {
  const baseMeta = resolveMetaTemplates(match.route.meta, match.params)
  const collector = createHeadCollector(baseMeta)

  withHeadCollector(collector, () => {
    const prev = renderMode.current
    renderMode.current = "stream"
    headlessRender(
      {
        write() {},
      },
      app
    )
    renderMode.current = prev
  })

  const resolvedMeta = await collector.resolve()
  return {
    headHtml: serializeDocumentHead(resolvedMeta, {
      pathname: match.pathname,
    }),
    title: resolvedMeta.title,
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

/** Layout stack + page only (no RouterProvider). Matches SSR/SSG body HTML. */
export function buildRoutedSubtree(
  match: RouteMatch,
  layoutModules: Array<RouteModule | null>,
  routeModule: RouteModule
) {
  let app = createElement(asComponent(routeModule), match.params)
  for (const module of layoutModules.slice().reverse()) {
    if (!module) continue
    app = createElement(asComponent(module), { children: app })
  }
  return app
}

function buildAppElement(
  match: RouteMatch,
  layoutModules: Array<RouteModule | null>,
  routeModule: RouteModule,
  manifest: RouteManifest
) {
  const staticRouter = createStaticRouter({
    manifest,
    pathname: match.pathname,
  })
  const subtree = buildRoutedSubtree(match, layoutModules, routeModule)
  return createElement(RouterProvider, {
    router: staticRouter,
    children: subtree,
  })
}

/** Shared SSG / SSR string render for a matched route. */
export async function renderMatchToStaticHtml(
  manifest: RouteManifest,
  match: RouteMatch
): Promise<{ body: string; document: DocumentHead }> {
  const { layoutModules, routeModule } = await loadRouteTree(match)
  const app = buildAppElement(match, layoutModules, routeModule, manifest)
  const document = await documentFromMatch(app, match)
  const body = renderToString(app)
  return { body, document }
}

const DEFAULT_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
}

export interface CreateRendererOptions {
  routes: RouteTreeDefinition | RouteManifest
  htmlTemplate?: string
}

export function createRenderer(options: CreateRendererOptions): Renderer {
  const { routes, htmlTemplate } = options
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const compiledTemplate =
    htmlTemplate !== undefined ? compileRouteHtmlTemplate(htmlTemplate) : null

  return {
    manifest,
    async render(url) {
      const pathname = toPathname(url)
      const match = matchRoute(manifest, pathname)
      if (!match) return null

      const { layoutModules, routeModule } = await loadRouteTree(match)
      const app = buildAppElement(match, layoutModules, routeModule, manifest)
      const document = await documentFromMatch(app, match)
      const body = renderToString(app)
      const html =
        compiledTemplate !== null
          ? compiledTemplate.render(body, document.headHtml)
          : body
      return {
        status: 200,
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
    async render(url) {
      const pathname = toPathname(url)
      const match = matchRoute(manifest, pathname)
      if (!match) return null

      const { layoutModules, routeModule } = await loadRouteTree(match)
      const app = buildAppElement(match, layoutModules, routeModule, manifest)
      const document = await documentFromMatch(app, match)
      const innerStream = renderToReadableStream(app)
      const streamBody =
        compiledTemplate !== null
          ? createTemplatedStream(
              innerStream,
              compiledTemplate.splitForStream(document.headHtml)
            )
          : innerStream
      return {
        status: 200,
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
