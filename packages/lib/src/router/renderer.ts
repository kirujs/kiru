import { Fragment } from "../element.js"
import { renderToString } from "../renderToString.js"
import { renderToReadableStream } from "../ssr/server.js"
import { headlessRender } from "../headlessRender.js"
import { renderMode } from "../globals.js"
import {
  compileRouteTree,
  generatePublicStaticPaths,
  matchRoute,
} from "./manifest.js"
import { tryServePrerenderedFromDisk } from "./prerenderServe.js"
import {
  buildRoutedSubtree,
  loadErrorRouteTree,
  loadNotFoundRouteTree,
  loadRootErrorRouteTree,
  loadRouteTree,
  type LeafRouteProps,
} from "./routeTree.js"
import {
  mergeImagePreloadsIntoHead,
  runWithImagePreloadRegistry,
} from "../image/preloadRegistry.js"
import { serializeDocumentHead } from "./meta.js"
import {
  formatPathname,
  pathnameForMatch,
  resolvePathPolicy,
  type RouterPathPolicy,
} from "./pathPolicy.js"
import {
  compileRouteHtmlTemplate,
  renderCompiledTemplate,
  validateRouteHtmlTemplate,
  type CompiledRouteHtmlTemplate,
} from "./htmlTemplate.js"
import { createStaticRouter } from "./csr.js"
import { serializeRequestContextScript } from "./requestContext.js"
import {
  detectLocaleFromRequest,
  formatPublicPathname,
  i18nToSiteLocales,
  loaderI18nFields,
  loadI18nMessages,
  resolveInvalidLocaleRedirect,
  shouldRejectInvalidLocale,
  shouldRunLocaleDetection,
  splitAppPathnameDetailed,
  type InternationalizationConfig,
} from "./i18n/index.js"
import {
  createI18nRuntime,
  serializeI18nScript,
  type HydratedI18nPayload,
} from "./i18nContext.js"
import { createSsrRouterShell } from "./routerShell.js"
import { createLoaderHandler } from "./loaderRegistry.js"
import { serializePageDataScript } from "./pageData.js"
import { buildLoaderContext, resolvePagePropsFromModule } from "./runPageLoad.js"
import {
  canStreamPageLoad,
  readLoaderFallback,
  readPageLoadExport,
  type KiruLoader,
  type PageProps,
} from "./loaders.js"
import {
  isDynamicPageHead,
  isStaticPageHead,
  mergeRouteAndPageHead,
  readPageHeadExport,
  resolvePageHead,
} from "./pageHead.js"
import { wrapRouteModuleWithLoadGate } from "./pageLoadGate.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"
import {
  cachePolicyToHeaders,
  mergeResponseHeaders,
  readRouteCacheExport,
  readRouteHeadersExport,
  readRouteStatusExport,
  resolveRouteStatus,
} from "./routeResponse.js"
import {
  getISRRevalidate,
  getISRTags,
  readRouteISRExport,
} from "./routeRevalidate.js"
import {
  diskPrerenderCache,
  setGlobalPrerenderCache,
  type PrerenderCacheEntry,
} from "./prerenderCache.js"
import {
  type CustomRequestContext,
  type DocumentHead,
  type ErrorPageProps,
  type RenderResult,
  type RouteHeadMeta,
  type RouteManifest,
  type RouteMatch,
  type RouteModule,
  type RouteTreeDefinition,
  type StreamRenderResult,
  toRenderError,
} from "./types.js"
import {
  makeKiruContextToken,
  createRemoteActionHandler,
} from "../remote/index.js"
import { __setSsrRequestContext } from "../remote/action.js"
import { runGuards, toRedirect } from "./runNavigationGuards.js"
import { parseRequestUrl, type RequestUrlState } from "./requestUrl.js"

export {
  buildRoutedSubtree,
  loadErrorRouteTree,
  loadNotFoundRouteTree,
  loadRootErrorRouteTree,
  loadRouteTree,
} from "./routeTree.js"

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
   * Prerender cache for ISR / on-demand revalidation. Defaults to
   * {@link diskPrerenderCache} when `prerenderedHtmlDir` is set.
   * @see docs/router/tier-3-wave-1.md#hybrid-isr
   */
  prerenderCache?: import("./prerenderCache.js").PrerenderCacheStore
  /**
   * When set, HTML responses include the signed context token and
   * {@link Renderer.render} handles remote `action` POSTs for the same `Request`.
   */
  actions?: RendererActionsOptions
  /** When true, `createRenderer` returns a streaming renderer contract. */
  stream?: boolean
  /** Base path and trailing-slash rules for URLs, prerender lookup, and head metadata. */
  pathPolicy?: RouterPathPolicy
  /** Locale-aware routing + SSR hydration of translation payloads. */
  i18n?: InternationalizationConfig<readonly string[], unknown>
}

function engine(options: CreateRendererOptions & { stream: boolean }) {
  const { manifest, compiledTemplate, actionsSecret, handleRemoteAction } =
    prepareRenderer(options)
  const pathPolicy = resolvePathPolicy(options.pathPolicy)
  const i18nConfig = options.i18n

  let prerenderPathSet: Promise<ReadonlySet<string>> | undefined
  const getPrerenderPathSet = (): Promise<ReadonlySet<string>> => {
    if (!prerenderPathSet) {
      prerenderPathSet = generatePublicStaticPaths(
        manifest,
        pathPolicy,
        undefined,
        i18nConfig ? i18nToSiteLocales(i18nConfig) : undefined
      ).then((paths) => new Set(paths))
    }
    return prerenderPathSet
  }

  let prerenderCacheInstance = options.prerenderCache
  if (!prerenderCacheInstance && options.prerenderedHtmlDir) {
    prerenderCacheInstance = diskPrerenderCache({
      clientDir: options.prerenderedHtmlDir,
      pathPolicy,
    })
  }
  if (prerenderCacheInstance) {
    setGlobalPrerenderCache(prerenderCacheInstance)
  }

  let bypassPrerenderServe = false

  const renderCoreInner = async (
    requestOrUrl: Request | string,
    ctx?: RenderRequestContext
  ) => {
    const url =
      typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url

    if (i18nConfig && typeof requestOrUrl === "object") {
      const rawPath = pathnameForMatch(toPathname(url), pathPolicy)
      const localeRedirect = tryLocaleDetectionRedirect(
        rawPath,
        requestOrUrl,
        i18nConfig,
        pathPolicy
      )
      if (localeRedirect) {
        return localeDetectionRedirectRenderHit(
          localeRedirect.location,
          localeRedirect.headers,
          options.stream
        )
      }
    }

    if (
      !bypassPrerenderServe &&
      (prerenderCacheInstance || options.prerenderedHtmlDir)
    ) {
      const pathnameForPrerender = toPathname(url)
      const prerenderMatch = matchRoute(
        manifest,
        pathnameForPrerender,
        pathPolicy
      )
      let isrConfig: ReturnType<typeof readRouteISRExport>
      if (prerenderMatch) {
        const pageMod = await prerenderMatch.route.component()
        isrConfig = readRouteISRExport(pageMod)
        const dynamicMode = isrConfig?.dynamic
        if (dynamicMode === "force-dynamic") {
          // skip prerender disk serve
        } else {
          const prerendered = await tryServePrerenderedFromDisk(
            requestOrUrl,
            url,
            {
              prerenderedHtmlDir: options.prerenderedHtmlDir,
              prerenderCache: prerenderCacheInstance,
              stream: options.stream,
              pathPolicy,
              getStaticPathSet: getPrerenderPathSet,
              actionsSecret: actionsSecret ?? "",
              onRegenerate: async (pathname) => {
                if (!prerenderCacheInstance) return
                bypassPrerenderServe = true
                try {
                  const regenHit = await renderCore(pathname, ctx)
                  const body =
                    regenHit?.kind === "string"
                      ? regenHit.result.body
                      : undefined
                  if (typeof body !== "string" || !body) return
                  const regenMod = await prerenderMatch.route.component()
                  const regenIsr = readRouteISRExport(regenMod)
                  const entry: PrerenderCacheEntry = {
                    html: body,
                    pathname,
                    generatedAt: Date.now(),
                    revalidate: getISRRevalidate(regenIsr) ?? false,
                    tags: getISRTags(regenIsr) ?? [],
                  }
                  await prerenderCacheInstance.set(pathname, entry)
                } finally {
                  bypassPrerenderServe = false
                }
              },
            },
            ctx
          )
          if (prerendered) return prerendered
          if (dynamicMode === "force-static") {
            return {
              kind: "string" as const,
              result: {
                status: 404,
                headers: { "content-type": "text/html; charset=utf-8" },
                body: "Not Found",
              },
            }
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
      const prepared = await prepareAppForUrl(
        url,
        ctx,
        manifest,
        pathPolicy,
        i18nConfig,
        typeof requestOrUrl === "object" ? requestOrUrl : undefined
      )
      if (!prepared) return null

      if (isPrepareRedirect(prepared)) {
        const redirectHeaders = {
          ...DEFAULT_HEADERS,
          location: prepared.location,
          ...prepared.headers,
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

      const {
        app,
        routeMatch,
        requestContext,
        serializedPageData,
        responseStatus,
        responseHeaders,
      } = prepared
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
              pageData: serializedPageData,
              streamHeadMeta: prepared.streamHeadMeta,
              pagePropsPromise: prepared.pagePropsPromise,
              earlyFlushHead: prepared.earlyFlushHead,
              i18nPayload: prepared.i18nPayload,
              documentLang: prepared.i18nPayload?.locale,
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
            status: routeMatch ? responseStatus : 404,
            headers: {
              ...DEFAULT_HEADERS,
              ...responseHeaders,
              "transfer-encoding": "chunked",
            },
            body: stream,
          },
        }
      }

      const { body, document } = routeMatch
        ? await renderStringWithDocument(
            app,
            routeMatch,
            requestContext,
            pathPolicy,
            serializedPageData,
            prepared.streamHeadMeta,
            prepared.i18nPayload
          )
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
          status: routeMatch ? responseStatus : 404,
          headers: { ...DEFAULT_HEADERS, ...responseHeaders },
          body:
            compiledTemplate !== null
              ? renderCompiledTemplate(
                  compiledTemplate,
                  fullBody,
                  fullHead,
                  prepared.i18nPayload?.locale
                )
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
              { error: renderErr } satisfies ErrorPageProps,
              {
                url: parseRequestUrl(url),
                pathPolicy,
              }
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

  const renderCore = (requestOrUrl: Request | string, ctx?: RenderRequestContext) =>
    runWithImagePreloadRegistry(() => renderCoreInner(requestOrUrl, ctx))

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
  requestContext: CustomRequestContext,
  pathPolicy?: RouterPathPolicy,
  pageData?: unknown,
  streamHeadMeta?: RouteHeadMeta,
  i18nPayload?: HydratedI18nPayload
): Promise<{ body: string; document: DocumentHead }> {
  let body = ""
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
    renderMode.current = prev
  }

  const resolvedMeta = mergeImagePreloadsIntoHead(
    streamHeadMeta ??
      mergeRouteAndPageHead(match.route.head, undefined, match.params)
  )
  const ctxScript = serializeRequestContextScript(requestContext)
  const pageDataScript =
    pageData !== undefined ? serializePageDataScript(pageData) : ""
  const i18nScript =
    i18nPayload !== undefined ? serializeI18nScript(i18nPayload) : ""
  return {
    body,
    document: {
      headHtml:
        serializeDocumentHead(resolvedMeta, {
          pathname: match.pathname,
          pathPolicy,
        }) +
        (ctxScript ? `\n    ${ctxScript}` : "") +
        (i18nScript ? `\n    ${i18nScript}` : "") +
        (pageDataScript ? `\n    ${pageDataScript}` : ""),
      title: resolvedMeta.title,
    },
  }
}

function buildAppElement(
  pathname: string,
  params: Record<string, string>,
  layoutModules: Array<RouteModule | null>,
  routeModule: RouteModule,
  manifest: RouteManifest,
  requestContext: CustomRequestContext,
  leafProps?: LeafRouteProps,
  options?: {
    url?: RequestUrlState
    pathPolicy?: RouterPathPolicy
    i18n?: HydratedI18nPayload
    siteLocales?: import("./localePolicy.js").SiteLocales
  }
) {
  const staticRouter = createStaticRouter({
    manifest,
    pathname,
    query: options?.url?.query ?? {},
    hash: options?.url?.hash ?? "",
    pathPolicy: options?.pathPolicy,
    siteLocales: options?.siteLocales,
    locale: options?.i18n?.locale,
  })
  staticRouter.params.value = params
  const subtree = buildRoutedSubtree(layoutModules, routeModule, leafProps)
  const i18nRuntime = options?.i18n
    ? createI18nRuntime({
        initialLocale: options.i18n.locale,
        initialData: options.i18n.data,
        locales: options.i18n.locales ?? [options.i18n.locale],
        defaultLocale: options.i18n.defaultLocale ?? options.i18n.locale,
      })
    : undefined
  return createSsrRouterShell(
    staticRouter,
    requestContext,
    () => subtree,
    undefined,
    i18nRuntime
  )
}

function serializedDataFromPageProps(
  pageProps: Record<string, unknown>
): unknown | undefined {
  if ("error" in pageProps && pageProps.error === null && "data" in pageProps) {
    return pageProps.data
  }
  return undefined
}

/** Shared SSG / SSR string render for a matched route. */
export async function renderMatchToStaticHtml(
  manifest: RouteManifest,
  match: RouteMatch,
  pathPolicy?: RouterPathPolicy,
  options?: {
    i18n?: InternationalizationConfig<readonly string[], unknown>
    locale?: string | null
  }
): Promise<{ body: string; document: DocumentHead }> {
  return runWithImagePreloadRegistry(() =>
    renderMatchToStaticHtmlInner(manifest, match, pathPolicy, options)
  )
}

async function renderMatchToStaticHtmlInner(
  manifest: RouteManifest,
  match: RouteMatch,
  pathPolicy?: RouterPathPolicy,
  options?: {
    i18n?: InternationalizationConfig<readonly string[], unknown>
    locale?: string | null
  }
): Promise<{ body: string; document: DocumentHead }> {
  // Prerender paths are pathname-only (no query string at build time).
  const pageMod = await match.route.component()
  const locale = options?.locale ?? null
  const loaderCtx = buildLoaderContext({
    params: match.params,
    pathname: match.pathname,
    search: "",
    hash: "",
    query: {},
    context: {},
    ...(options?.i18n && locale
      ? loaderI18nFields(options.i18n, locale)
      : {}),
  })
  const { props: pageProps } = await resolvePagePropsFromModule(pageMod, loaderCtx)
  const streamHeadMeta = resolveStreamHeadMeta(
    match,
    pageMod,
    loaderCtx,
    pageProps as PageProps<KiruLoader<unknown>>
  )
  const i18nPayload =
    options?.i18n && locale
      ? {
          locale,
          data: await loadI18nMessages(options.i18n, locale),
          locales: options.i18n.locales,
          defaultLocale: options.i18n.default,
        }
      : undefined
  const siteLocales =
    options?.i18n && locale ? i18nToSiteLocales(options.i18n) : undefined
  const { layoutModules, routeModule } = await loadRouteTree(match)
  const app = buildAppElement(
    match.pathname,
    match.params,
    layoutModules,
    routeModule,
    manifest,
    {},
    pageProps,
    { pathPolicy, i18n: i18nPayload, siteLocales }
  )
  return renderStringWithDocument(
    app,
    match,
    {},
    pathPolicy,
    serializedDataFromPageProps(pageProps),
    streamHeadMeta,
    i18nPayload
  )
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
  /** Loader data embedded in HTML for hydration (success path only). */
  serializedPageData?: unknown
  /** Merged route + page head for document assembly. */
  streamHeadMeta?: RouteHeadMeta
  /** In-flight loader when shell streams before load settles. */
  pagePropsPromise?: Promise<Record<string, unknown>>
  /** Flush static head prefix before shell render. */
  earlyFlushHead?: boolean
  i18nPayload?: HydratedI18nPayload
  responseStatus: number
  responseHeaders: Record<string, string>
}

type PrepareRedirect = {
  kind: "redirect"
  location: string
  headers?: Record<string, string>
}

type PrepareAppResult = PreparedApp | PrepareRedirect | null

function isPrepareRedirect(
  p: Exclude<PrepareAppResult, null>
): p is PrepareRedirect {
  return "kind" in p && p.kind === "redirect"
}

const MAX_SSR_BEFORE_ENTER_REDIRECTS = 16

function resolveStreamHeadMeta(
  match: RouteMatch,
  pageMod: unknown,
  loaderCtx: ReturnType<typeof buildLoaderContext>,
  pageProps?: PageProps<KiruLoader<unknown>>
): RouteHeadMeta {
  const pageHead = readPageHeadExport(pageMod)
  let pageHeadMeta: RouteHeadMeta | undefined
  if (pageHead) {
    pageHeadMeta = resolvePageHead(pageHead, loaderCtx, pageProps)
  }
  return mergeRouteAndPageHead(match.route.head, pageHeadMeta, match.params)
}

function localePreferenceCookie(
  config: InternationalizationConfig<readonly string[], unknown>,
  locale: string
): string {
  return `${config.localeCookie}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`
}

function tryLocaleDetectionRedirect(
  rawPath: string,
  request: Request | undefined,
  i18n: InternationalizationConfig<readonly string[], unknown>,
  pathPolicy: ReturnType<typeof resolvePathPolicy>
): { location: string; headers: Record<string, string> } | null {
  if (!request || !shouldRunLocaleDetection(rawPath, i18n)) return null
  const siteLocales = i18nToSiteLocales(i18n)
  const detected = detectLocaleFromRequest(request, i18n)
  const target = formatPublicPathname("/", detected, siteLocales, pathPolicy)
  const current = formatPathname(rawPath, pathPolicy)
  if (target === current) return null
  return {
    location: target,
    headers: { "set-cookie": localePreferenceCookie(i18n, detected) },
  }
}

function localeDetectionRedirectRenderHit(
  location: string,
  extraHeaders: Record<string, string>,
  stream: boolean
) {
  const redirectHeaders = {
    ...DEFAULT_HEADERS,
    location,
    ...extraHeaders,
  }
  if (stream) {
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

async function prepareAppForUrl(
  url: string,
  ctx: RenderRequestContext | undefined,
  manifest: RouteManifest,
  pathPolicy: ReturnType<typeof resolvePathPolicy>,
  i18n?: InternationalizationConfig<readonly string[], unknown>,
  request?: Request
): Promise<PrepareAppResult> {
  const requestUrl = parseRequestUrl(url)
  const rawPath = pathnameForMatch(toPathname(url), pathPolicy)

  const localeRedirect =
    i18n && tryLocaleDetectionRedirect(rawPath, request, i18n, pathPolicy)
  if (localeRedirect) {
    return {
      kind: "redirect",
      location: localeRedirect.location,
      headers: localeRedirect.headers,
    }
  }

  let locale: string | null = null
  let logicalPath = rawPath
  if (i18n) {
    const siteLocales = i18nToSiteLocales(i18n)
    const split = splitAppPathnameDetailed(rawPath, siteLocales)
    if (split.kind === "invalid-locale") {
      if (shouldRejectInvalidLocale(siteLocales)) {
        logicalPath = split.pathname
        locale = split.locale
      } else {
        const location = resolveInvalidLocaleRedirect(split, siteLocales, pathPolicy)
        return { kind: "redirect", location }
      }
    } else {
      logicalPath = split.pathname
      locale = split.locale
    }
  }
  const requestedPathname = formatPathname(logicalPath, pathPolicy)
  let path = requestedPathname

  for (let depth = 0; depth < MAX_SSR_BEFORE_ENTER_REDIRECTS; depth++) {
    const routeMatch = matchRoute(manifest, path, pathPolicy)

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
          requestContext,
          undefined,
          { url: requestUrl, pathPolicy }
        )
        return {
          app,
          routeMatch: null,
          requestContext,
          responseStatus: 404,
          responseHeaders: mergeResponseHeaders(ctx?.headers),
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

    const searchCheck = await validateSearchForMatch(routeMatch, requestUrl.query, {
      hash: requestUrl.hash,
    })
    if (!searchCheck.ok) {
      if (searchCheck.failure.kind === "redirect") {
        return { kind: "redirect", location: searchCheck.failure.location }
      }
      return null
    }

    const requestContext = (ctx?.context ?? {}) as CustomRequestContext
    const loaderCtx = buildLoaderContext({
      params: searchCheck.params,
      pathname: routeMatch.pathname,
      search: requestUrl.search,
      hash: requestUrl.hash,
      query: requestUrl.query,
      validatedQuery: searchCheck.validatedQuery,
      context: requestContext,
      ...loaderI18nFields(i18n, locale),
    })
    const pageMod = await routeMatch.route.component()
    const pageHead = readPageHeadExport(pageMod)
    const load = readPageLoadExport(pageMod)
    const streamPageLoad =
      canStreamPageLoad(load) && isStaticPageHead(pageHead)
    const dynamicHead = isDynamicPageHead(pageHead)

    let pageProps: Record<string, unknown>
    let pagePropsPromise: Promise<Record<string, unknown>> | undefined

    if (streamPageLoad) {
      // Loader data is streamed via `resource()` / `__$k_data` in the load gate;
      // do not await `resolvePagePropsFromModule` here or the shell blocks on load.
      pageProps = {}
    } else {
      pageProps = (await resolvePagePropsFromModule(pageMod, loaderCtx)).props
    }

    const streamHeadMeta = resolveStreamHeadMeta(
      routeMatch,
      pageMod,
      loaderCtx,
      dynamicHead || !streamPageLoad
        ? (pageProps as PageProps<KiruLoader<unknown>>)
        : undefined
    )

    const { layoutModules, routeModule: rawRouteModule } =
      await loadRouteTree(routeMatch)
    let routeModule = rawRouteModule
    if (streamPageLoad && load) {
      const fallback = readLoaderFallback(load)
      if (fallback) {
        routeModule = wrapRouteModuleWithLoadGate(
          rawRouteModule,
          load,
          loaderCtx,
          fallback
        )
      }
    }

    const i18nPayload =
      i18n && locale
        ? {
            locale,
            data: await loadI18nMessages(i18n, locale),
            locales: i18n.locales,
            defaultLocale: i18n.default,
          }
        : undefined
    const siteLocales =
      i18n && locale ? i18nToSiteLocales(i18n) : undefined

    const app = buildAppElement(
      routeMatch.pathname,
      routeMatch.params,
      layoutModules,
      routeModule,
      manifest,
      requestContext,
      pageProps as LeafRouteProps,
      { url: requestUrl, pathPolicy, i18n: i18nPayload, siteLocales }
    )

    const pagePropsForMeta = dynamicHead || !streamPageLoad
      ? (pageProps as PageProps<KiruLoader<unknown>>)
      : undefined
    const resolvedStatus = resolveRouteStatus(
      readRouteStatusExport(pageMod),
      loaderCtx,
      pagePropsForMeta
    )
    const responseStatus = resolvedStatus ?? 200
    const routeHeadersExport = readRouteHeadersExport(pageMod)
    const responseHeaders = mergeResponseHeaders(
      ctx?.headers,
      cachePolicyToHeaders(
        readRouteCacheExport(pageMod),
        routeMatch.route.static === true,
        getISRRevalidate(readRouteISRExport(pageMod))
      ),
      routeHeadersExport?.resolve(loaderCtx, pagePropsForMeta)
    )

    return {
      app,
      routeMatch,
      requestContext,
      serializedPageData: streamPageLoad
        ? undefined
        : serializedDataFromPageProps(pageProps),
      streamHeadMeta,
      pagePropsPromise,
      earlyFlushHead: streamPageLoad,
      i18nPayload,
      responseStatus,
      responseHeaders,
    }
  }

  return null
}

function buildStreamDocumentHead(
  meta: RouteHeadMeta,
  pathname: string,
  requestContext: CustomRequestContext,
  opts: {
    pageData?: unknown
    i18nPayload?: HydratedI18nPayload
    decorateDocument: (document: DocumentHead) => void
  }
): DocumentHead {
  const ctxScript = serializeRequestContextScript(requestContext)
  const pageDataScript =
    opts.pageData !== undefined ? serializePageDataScript(opts.pageData) : ""
  const i18nScript =
    opts.i18nPayload !== undefined ? serializeI18nScript(opts.i18nPayload) : ""
  const document: DocumentHead = {
    headHtml:
      serializeDocumentHead(meta, { pathname }) +
      (ctxScript ? `\n    ${ctxScript}` : "") +
      (i18nScript ? `\n    ${i18nScript}` : "") +
      (pageDataScript ? `\n    ${pageDataScript}` : ""),
    title: meta.title,
  }
  opts.decorateDocument(document)
  return document
}

/**
 * Streaming SSR: defers document assembly into `onShellReady` so `</html>`
 * precedes streamed data scripts. Static page head + streaming load flushes
 * the head prefix in `onStreamStart` while the shell renders.
 */
function renderStreamForRouteMatch(
  app: JSX.Element,
  match: RouteMatch,
  requestContext: CustomRequestContext,
  opts: {
    compiledTemplate: CompiledRouteHtmlTemplate | null
    decorateDocument: (document: DocumentHead) => void
    pageData?: unknown
    streamHeadMeta?: RouteHeadMeta
    pagePropsPromise?: Promise<Record<string, unknown>>
    earlyFlushHead?: boolean
    i18nPayload?: HydratedI18nPayload
    documentLang?: string
  }
): ReadableStream<string> {
  const { pathname } = match
  const mergedMeta = mergeImagePreloadsIntoHead(
    opts.streamHeadMeta ??
      mergeRouteAndPageHead(match.route.head, undefined, match.params)
  )
  const mayEarlyFlush =
    !!opts.earlyFlushHead &&
    opts.compiledTemplate?.headBeforeBody === true
  let streamedHeadEarly = false

  const headWithoutPageData = () =>
    buildStreamDocumentHead(mergedMeta, pathname, requestContext, {
      decorateDocument: opts.decorateDocument,
    })

  __setSsrRequestContext(requestContext)
  const stream = renderToReadableStream(app, {
    onStreamStart: mayEarlyFlush
      ? (controller) => {
          const document = headWithoutPageData()
          const split = opts.compiledTemplate!.splitForStream(
            document.headHtml,
            opts.documentLang
          )
          controller.enqueue(split.prefix)
          streamedHeadEarly = true
        }
      : undefined,
    onShellReady: async (shell, controller) => {
      if (streamedHeadEarly) {
        // Flush layout + fallback + `</html>` immediately so the parser can
        // close the document and the async entry script can hydrate while load
        // is still in flight. Loader data follows via streamed `__$k_data`.
        enqueueTemplatedShellBody(controller, {
          compiledTemplate: opts.compiledTemplate,
          shell,
        })
        return
      }
      let pageData = opts.pageData
      if (opts.pagePropsPromise) {
        const props = await opts.pagePropsPromise
        pageData = serializedDataFromPageProps(props)
      }
      const document = buildStreamDocumentHead(
        mergedMeta,
        pathname,
        requestContext,
        {
          pageData,
          i18nPayload: opts.i18nPayload,
          decorateDocument: opts.decorateDocument,
        }
      )
      enqueueTemplatedShell(controller, {
        compiledTemplate: opts.compiledTemplate,
        headHtml: document.headHtml,
        shell,
        documentLang: opts.documentLang,
      })
    },
  })
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
    documentLang?: string
  }
): void {
  if (!args.compiledTemplate) {
    controller.enqueue(args.shell)
    return
  }
  const split = args.compiledTemplate.splitForStream(
    args.headHtml,
    args.documentLang
  )
  controller.enqueue(split.prefix)
  controller.enqueue(args.shell)
  controller.enqueue(split.suffix)
}

function enqueueTemplatedShellBody(
  controller: ReadableStreamDefaultController<string>,
  args: {
    compiledTemplate: CompiledRouteHtmlTemplate | null
    shell: string
  }
): void {
  if (!args.compiledTemplate) {
    controller.enqueue(args.shell)
    return
  }
  controller.enqueue(args.shell)
  controller.enqueue(args.compiledTemplate.splitForStream("").suffix)
}

function prepareRenderer(options: CreateRendererOptions) {
  const { routes, htmlTemplate, actions } = options
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const compiledTemplate =
    htmlTemplate !== undefined ? compileRouteHtmlTemplate(htmlTemplate) : null
  if (htmlTemplate !== undefined) {
    validateRouteHtmlTemplate(htmlTemplate, { i18n: !!options.i18n })
  }
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
  const handleLoader = actions
    ? createLoaderHandler(actions.secret, {
        allowedOrigins: actions.allowedOrigins,
      })
    : null
  const handlePost =
    handleRemoteAction || handleLoader
      ? async (request: Request) => {
          if (handleLoader) {
            const loaderResponse = await handleLoader(request)
            if (loaderResponse) return loaderResponse
          }
          if (handleRemoteAction) {
            return handleRemoteAction(request)
          }
          return null
        }
      : null
  return {
    manifest,
    compiledTemplate,
    actionsSecret,
    handleRemoteAction: handlePost,
  }
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
