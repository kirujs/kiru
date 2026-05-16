import { createElement, Fragment } from "../element.js"
import { renderToString } from "../renderToString.js"
import { renderToReadableStream } from "../ssr/server.js"
import { headlessRender } from "../headlessRender.js"
import { renderMode } from "../globals.js"
import {
  compileRouteTree,
  generateStaticPaths,
  matchRoute,
} from "./manifest.js"
import {
  hydratePrerenderedHtmlForRequest,
  tryReadPrerenderedHtml,
} from "./prerenderedHtml.js"
import {
  buildRoutedSubtree,
  loadErrorRouteTree,
  loadNotFoundRouteTree,
  loadRootErrorRouteTree,
  loadRouteTree,
} from "./routeTree.js"
import { resolveMetaTemplates, serializeDocumentHead } from "./meta.js"
import {
  compileRouteHtmlTemplate,
  type CompiledRouteHtmlTemplate,
} from "./htmlTemplate.js"
import { RouterProvider, createStaticRouter } from "./csr.js"
import { createHeadCollector, withHeadCollector } from "./headContext.js"
import {
  RequestContextProvider,
  serializeRequestContextScript,
} from "./requestContext.js"
import {
  type CustomRequestContext,
  type DocumentHead,
  type ErrorPageProps,
  type RenderResult,
  type RouteManifest,
  type RouteMatch,
  type RouteModule,
  type RouteTreeDefinition,
  type StreamRenderResult,
  toRenderError,
} from "./types.js"
import { makeKiruContextToken, createRemoteActionHandler } from "../remote/index.js"
import { __setSsrRequestContext } from "../remote/action.js"
import { runGuards, toRedirect } from "./runNavigationGuards.js"

/** Serialized `k-request-token` script for remote actions (SSR / prerender hydration). */
export function serializeKiruRequestTokenScript(
  ctx: CustomRequestContext | null | undefined,
  secret: string
): string {
  if (!ctx) return ""
  const token = makeKiruContextToken(ctx, secret)
  return `<script type="application/json" k-request-token>${token}</script>`
}


export interface RenderRequestContext {
  headers?: HeadersInit
  method?: string
  context?: CustomRequestContext
}

export type RendererActionsOptions = {
  secret: string
  /**
   * If non-empty, require `Origin` or `Referer` to match one of these strings
   * (exact origin). Use `"*"` to disable the check.
   */
  allowedOrigins?: string[]
  /** When true, `RemoteError` instances are serialized as JSON responses. */
  exposeErrors?: boolean
}

export interface StreamRenderer {
  manifest: RouteManifest
  render(
    requestOrUrl: Request | string,
    context?: RenderRequestContext
  ): Promise<StreamRenderResult | null>
}

export interface Renderer {
  manifest: RouteManifest
  render(
    requestOrUrl: Request | string,
    context?: RenderRequestContext
  ): Promise<RenderResult | null>
}

export type CreateRendererOptions = {
  routes: RouteTreeDefinition | RouteManifest
  htmlTemplate?: string
  /**
   * Absolute path to the Vite client output directory (e.g.
   * `resolveStatic(import.meta.url).clientDir`).
   *
   * When **`process.env.NODE_ENV === "production"`**, {@link Renderer.render}
   * serves prerendered HTML from disk for URLs in {@link generateStaticPaths}
   * before SSR. In development, disk reads are never used — static routes are
   * always server-rendered like any other route.
   *
   * Safe with SSR-only routes because reads are gated by {@link generateStaticPaths}
   * (see {@link tryReadPrerenderedHtml}).
   */
  prerenderedHtmlDir?: string
  /**
   * When set, HTML responses include the signed context token and
   * {@link Renderer.render} handles remote `action` POSTs for the same `Request`.
   */
  actions?: RendererActionsOptions
  /** When true, `createRenderer` returns a streaming renderer contract. */
  stream?: boolean
}

function engine(options: CreateRendererOptions & { stream: boolean }) {
  const { manifest, compiledTemplate, actionsSecret, handleRemoteAction } =
    prepareRenderer(options)

  let prerenderPathSet: Promise<ReadonlySet<string>> | undefined
  const getPrerenderPathSet = (): Promise<ReadonlySet<string>> => {
    if (!prerenderPathSet) {
      prerenderPathSet = generateStaticPaths(manifest).then(
        (paths) => new Set(paths)
      )
    }
    return prerenderPathSet
  }

  const servePrerenderedFromDisk =
    !!options.prerenderedHtmlDir &&
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "production"

  const renderCore = async (
    requestOrUrl: Request | string,
    ctx?: RenderRequestContext
  ) => {
    const url =
      typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url

    if (servePrerenderedFromDisk) {
      const allowPrerenderRead =
        typeof requestOrUrl === "string" || requestOrUrl.method === "GET"
      if (allowPrerenderRead) {
        const pathname = new URL(url, "http://localhost").pathname
        const html = tryReadPrerenderedHtml(
          options.prerenderedHtmlDir!,
          pathname,
          { staticPaths: await getPrerenderPathSet() }
        )
        if (html) {
          const requestContext = (ctx?.context ??
            null) as CustomRequestContext
          const hydrated = hydratePrerenderedHtmlForRequest(
            html,
            requestContext,
            actionsSecret
          )
          if (options.stream) {
            return {
              kind: "stream" as const,
              result: {
                status: 200,
                headers: { ...DEFAULT_HEADERS },
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
            kind: "string" as const,
            result: {
              status: 200,
              headers: DEFAULT_HEADERS,
              body: hydrated,
            },
          }
        }
      }
    }

    const requestedPathForErrors = toPathname(url)
    let failureContext:
      | {
          match: RouteMatch | null
          requestContext: CustomRequestContext
          pathname: string
        }
      | undefined

    try {
      const prepared = await prepareAppForUrl(url, ctx, manifest)
      if (!prepared) return null

      if (isPrepareRedirect(prepared)) {
        const redirectHeaders = {
          ...DEFAULT_HEADERS,
          location: prepared.location,
        }
        if (options.stream) {
          return {
            kind: "stream" as const,
            result: {
              status: 302,
              headers: redirectHeaders,
              body: new ReadableStream<string>({
                start(controller) {
                  controller.close()
                },
              }),
            },
          }
        }
        return {
          kind: "string" as const,
          result: {
            status: 302,
            headers: redirectHeaders,
            body: "",
          },
        }
      }

      const { app, routeMatch, requestContext } = prepared
      failureContext = {
        match: routeMatch,
        requestContext,
        pathname: routeMatch?.pathname ?? requestedPathForErrors,
      }

      if (options.stream) {
        // Assemble the full static document (prefix + shell + suffix) in a
        // single `onShellReady` flush so the browser sees `</html>` before
        // the streamed data scripts arrive. That lets `DOMContentLoaded`
        // fire on the closing tag (rather than on connection close), so an
        // implicitly-deferred `<script type="module">` entry tag hydrates
        // immediately instead of waiting on the slowest in-flight resource.
        const decorateDocument = (document: DocumentHead) => {
          if (actionsSecret)
            appendTokenToDocument(document, requestContext, actionsSecret)
        }

        const stream = routeMatch
          ? renderStreamForRouteMatch(app, routeMatch, requestContext, {
              compiledTemplate,
              decorateDocument,
            })
          : (() => {
              __setSsrRequestContext(requestContext)
              const document: DocumentHead = {
                headHtml: serializeRequestContextScript(requestContext),
              }
              decorateDocument(document)
              const s = renderToReadableStream(app, {
                onShellReady: (shell, controller) =>
                  enqueueTemplatedShell(controller, {
                    compiledTemplate,
                    headHtml: document.headHtml,
                    shell,
                  }),
              })
              __setSsrRequestContext({})
              return s
            })()

        return {
          kind: "stream" as const,
          result: {
            status: routeMatch ? 200 : 404,
            headers: { ...DEFAULT_HEADERS, "transfer-encoding": "chunked" },
            body: stream,
          },
        }
      }

      const { body, document } = routeMatch
        ? await renderStringWithDocument(app, routeMatch, requestContext)
        : {
            body: renderToString(app),
            document: {
              headHtml: serializeRequestContextScript(requestContext),
            },
          }

      if (actionsSecret)
        appendTokenToDocument(document, requestContext, actionsSecret)

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
    } catch (caught) {
      const renderErr = toRenderError(caught)

      let recovery:
        | {
            app: JSX.Element
            requestContext: CustomRequestContext
          }
        | undefined
      try {
        const tree =
          failureContext?.match != null
            ? await loadErrorRouteTree(failureContext.match)
            : await loadRootErrorRouteTree(manifest)
        if (tree) {
          const requestContext =
            failureContext?.requestContext ??
            ((ctx?.context ?? {}) as CustomRequestContext)
          recovery = {
            app: buildAppElement(
              failureContext?.pathname ?? requestedPathForErrors,
              failureContext?.match?.params ?? {},
              tree.layoutModules,
              tree.routeModule,
              manifest,
              requestContext,
              { error: renderErr } satisfies ErrorPageProps
            ),
            requestContext,
          }
        }
      } catch {
        recovery = undefined
      }

      if (recovery) {
        const { app: recoveryApp, requestContext: recoveryCtx } = recovery

        if (options.stream) {
          __setSsrRequestContext(recoveryCtx)
          const document: DocumentHead = {
            headHtml: serializeRequestContextScript(recoveryCtx),
          }
          if (actionsSecret)
            appendTokenToDocument(document, recoveryCtx, actionsSecret)
          const stream = renderToReadableStream(recoveryApp, {
            onShellReady: (shell, controller) =>
              enqueueTemplatedShell(controller, {
                compiledTemplate,
                headHtml: document.headHtml,
                shell,
              }),
          })
          __setSsrRequestContext({})

          return {
            kind: "stream" as const,
            result: {
              status: 500,
              headers: { ...DEFAULT_HEADERS, "transfer-encoding": "chunked" },
              body: stream,
            },
          }
        }

        let body = ""
        __setSsrRequestContext(recoveryCtx)
        try {
          body = renderToString(recoveryApp)
        } finally {
          __setSsrRequestContext({})
        }

        const documentHead: DocumentHead = {
          headHtml: serializeRequestContextScript(recoveryCtx),
        }
        if (actionsSecret)
          appendTokenToDocument(documentHead, recoveryCtx, actionsSecret)
        const fullHead =
          documentHead.headHtml +
          (documentHead.headEndHtml ? `\n    ${documentHead.headEndHtml}` : "")
        const fullBody = body + (documentHead.bodyEndHtml ?? "")
        return {
          kind: "string" as const,
          result: {
            status: 500,
            headers: DEFAULT_HEADERS,
            body:
              compiledTemplate !== null
                ? compiledTemplate.render(fullBody, fullHead)
                : fullBody,
          },
        }
      }

      const body = `<!DOCTYPE html><html><head><title>Error</title></head><body><pre>${String(
        renderErr.message
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

  return { manifest, renderCore, handleRemoteAction }
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
  const { manifest, renderCore, handleRemoteAction } = engine({
    ...options,
    stream,
  })

  if (stream) {
    return {
      manifest,
      async render(requestOrUrl, ctx) {
        if (handleRemoteAction && requestOrUrl instanceof Request) {
          const actionResponse = await handleRemoteAction(requestOrUrl)
          if (actionResponse)
            return responseToStreamRenderResult(actionResponse)
        }
        const out = await renderCore(requestOrUrl, ctx)
        if (!out) return null
        return out.result as StreamRenderResult
      },
    }
  }

  return {
    manifest,
    async render(requestOrUrl, ctx) {
      if (handleRemoteAction && requestOrUrl instanceof Request) {
        const actionResponse = await handleRemoteAction(requestOrUrl)
        if (actionResponse) return responseToRenderResult(actionResponse)
      }
      const out = await renderCore(requestOrUrl, ctx)
      if (!out) return null
      return out.result as RenderResult
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
  requestContext: CustomRequestContext
): Promise<{ body: string; document: DocumentHead }> {
  const baseMeta = resolveMetaTemplates(match.route.head, match.params)
  const collector = createHeadCollector(baseMeta)

  let body = ""
  withHeadCollector(collector, () => {
    const prev = renderMode.current
    renderMode.current = "stream"
    __setSsrRequestContext(requestContext as Record<string, unknown>)
    try {
      headlessRender(
        {
          write(chunk) {
            body += chunk
          },
        },
        Fragment({ children: app })
      )
    } finally {
      __setSsrRequestContext({})
    }
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

export {
  buildRoutedSubtree,
  loadErrorRouteTree,
  loadNotFoundRouteTree,
  loadRootErrorRouteTree,
  loadRouteTree,
} from "./routeTree.js"

function buildAppElement(
  pathname: string,
  params: Record<string, string>,
  layoutModules: Array<RouteModule | null>,
  routeModule: RouteModule,
  manifest: RouteManifest,
  requestContext: CustomRequestContext,
  leafProps?: ErrorPageProps
) {
  const staticRouter = createStaticRouter({
    manifest,
    pathname,
    query: {},
    hash: "",
  })
  staticRouter.params.value = params
  const subtree = buildRoutedSubtree(layoutModules, routeModule, leafProps)
  return createElement(RequestContextProvider, {
    value: requestContext,
    children: createElement(RouterProvider, {
      router: staticRouter,
      children: () => subtree,
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
    {}
  )
  return renderStringWithDocument(app, match, {})
}

const DEFAULT_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
}

function headersRecordFromResponse(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

async function responseToRenderResult(res: Response): Promise<RenderResult> {
  return {
    status: res.status,
    headers: headersRecordFromResponse(res.headers),
    body: await res.text(),
  }
}

async function responseToStreamRenderResult(
  res: Response
): Promise<StreamRenderResult> {
  const text = await res.text()
  return {
    status: res.status,
    headers: headersRecordFromResponse(res.headers),
    body: new ReadableStream<string>({
      start(controller) {
        controller.enqueue(text)
        controller.close()
      },
    }),
  }
}

type PreparedApp = {
  app: JSX.Element
  routeMatch: RouteMatch | null
  requestContext: CustomRequestContext
}

type PrepareAppResult =
  | PreparedApp
  | { kind: "redirect"; location: string }
  | null

type PrepareRedirect = { kind: "redirect"; location: string }

function isPrepareRedirect(
  p: Exclude<PrepareAppResult, null>
): p is PrepareRedirect {
  return "kind" in p && p.kind === "redirect"
}

const MAX_SSR_BEFORE_ENTER_REDIRECTS = 16

async function prepareAppForUrl(
  url: string,
  ctx: RenderRequestContext | undefined,
  manifest: RouteManifest
): Promise<PrepareAppResult> {
  const requestedPathname = toPathname(url)
  let path = requestedPathname

  for (let depth = 0; depth < MAX_SSR_BEFORE_ENTER_REDIRECTS; depth++) {
    const routeMatch = matchRoute(manifest, path)

    if (!routeMatch) {
      if (path === requestedPathname) {
        const notFoundTree = await loadNotFoundRouteTree(
          manifest,
          requestedPathname
        )
        if (!notFoundTree) return null
        const requestContext = (ctx?.context ?? {}) as CustomRequestContext
        const { layoutModules, routeModule } = notFoundTree
        const app = buildAppElement(
          requestedPathname,
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
      return null
    }

    const routeGuards = routeMatch.route.beforeEnter ?? []
    if (routeGuards.length) {
      const to = {
        pathname: routeMatch.pathname,
        params: routeMatch.params,
      }
      const g2 = await runGuards(routeGuards, to, null)
      if (g2.type === "cancel") return null
      if (g2.type === "redirect") {
        path = toPathname(toRedirect(g2.to).path)
        continue
      }
    }

    if (path !== requestedPathname) {
      return { kind: "redirect", location: path }
    }

    const requestContext = (ctx?.context ?? null) as CustomRequestContext
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

  return null
}

/**
 * Streaming counterpart to {@link renderStringWithDocument}: starts the
 * readable stream inside the head collector so meta tags are captured, then
 * defers full document assembly into the stream's `onShellReady` hook —
 * which fires only after the head collector has resolved, so the prefix
 * (containing the serialized head) can be flushed atomically with the
 * shell and the document close tags. Streamed data scripts arrive after
 * `</html>`, keeping `DOMContentLoaded` (and hydration) prompt.
 */
function renderStreamForRouteMatch(
  app: JSX.Element,
  match: RouteMatch,
  requestContext: CustomRequestContext,
  opts: {
    compiledTemplate: CompiledRouteHtmlTemplate | null
    decorateDocument: (document: DocumentHead) => void
  }
): ReadableStream<string> {
  const { route, params, pathname } = match
  const collector = createHeadCollector(
    resolveMetaTemplates(route.head, params)
  )
  __setSsrRequestContext(requestContext)
  const stream = withHeadCollector(collector, () =>
    renderToReadableStream(app, {
      onShellReady: async (shell, controller) => {
        const resolvedMeta = await collector.resolve()
        const ctxScript = serializeRequestContextScript(requestContext)
        const document: DocumentHead = {
          headHtml:
            serializeDocumentHead(resolvedMeta, { pathname }) +
            (ctxScript ? `\n    ${ctxScript}` : ""),
          title: resolvedMeta.title,
        }
        opts.decorateDocument(document)
        enqueueTemplatedShell(controller, {
          compiledTemplate: opts.compiledTemplate,
          headHtml: document.headHtml,
          shell,
        })
      },
    })
  )
  __setSsrRequestContext({})
  return stream
}

/**
 * Flush prefix + shell + suffix into the streaming controller in one shot.
 * When no template is configured we pass the shell through unchanged.
 */
function enqueueTemplatedShell(
  controller: ReadableStreamDefaultController<string>,
  args: {
    compiledTemplate: CompiledRouteHtmlTemplate | null
    headHtml: string
    shell: string
  }
): void {
  if (!args.compiledTemplate) {
    controller.enqueue(args.shell)
    return
  }
  const split = args.compiledTemplate.splitForStream(args.headHtml)
  controller.enqueue(split.prefix)
  controller.enqueue(args.shell)
  controller.enqueue(split.suffix)
}

function prepareRenderer(options: CreateRendererOptions) {
  const { routes, htmlTemplate, actions } = options
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const compiledTemplate =
    htmlTemplate !== undefined ? compileRouteHtmlTemplate(htmlTemplate) : null
  if (options.stream && htmlTemplate !== undefined) {
    warnIfStreamingTemplateLacksAsyncEntry(htmlTemplate)
  }
  const actionsSecret = actions?.secret
  const handleRemoteAction = actions
    ? createRemoteActionHandler(actions.secret, {
        allowedOrigins: actions.allowedOrigins,
        exposeErrors: actions.exposeErrors,
      })
    : null
  return { manifest, compiledTemplate, actionsSecret, handleRemoteAction }
}

/**
 * Streaming SSR holds the document parser open until the slowest in-flight
 * resource resolves. `<script type="module" src="…">` is implicitly
 * deferred to `DOMContentLoaded` — which doesn't fire until the parser hits
 * EOF (i.e. connection close) — so without `async` the entry script
 * doesn't run and hydration stalls until the slowest resource completes.
 *
 * We emit a one-shot console warning at `createRenderer({ stream: true })`
 * time listing the offending entry scripts and showing the recommended
 * fix. Auto-rewriting would be invasive (and could surprise users with
 * explicit ordering needs), so we just nudge.
 */
function warnIfStreamingTemplateLacksAsyncEntry(template: string): void {
  const re =
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/g
  const offenders: { tag: string; src: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    if (/\basync\b/.test(m[0])) continue
    offenders.push({ tag: m[0], src: m[1] })
  }
  if (offenders.length === 0) return

  const list = offenders
    .map(({ src }) => `  • <script type="module" src="${src}">`)
    .join("\n")
  const example = `  <script type="module" async src="${offenders[0].src}">`

  // eslint-disable-next-line no-console
  console.warn(
    `[kiru] Streaming SSR is enabled but the HTML template contains entry script tag(s) without \`async\`:\n${list}\n\n` +
      `\`<script type="module">\` is implicitly deferred to \`DOMContentLoaded\`, which does not fire until the streamed response closes — so hydration will block on the slowest in-flight \`resource()\` call.\n\n` +
      `Add \`async\` to hydrate as soon as the script downloads:\n${example}\n`
  )
}

function appendTokenToDocument(
  document: DocumentHead,
  requestContext: CustomRequestContext,
  secret: string
): void {
  const tag = serializeKiruRequestTokenScript(requestContext, secret)
  if (!tag) return
  document.headHtml += `\n    ${tag}`
}

function toPathname(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname
  } catch {
    return url
  }
}
