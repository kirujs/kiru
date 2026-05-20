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
  getI18nLocaleRouting,
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
  loaderSignalFromRequest,
  isAbortError,
  throwIfAborted,
} from "./navigationScope.js"
import {
  emitStaticLoaderPrerenderCapture,
  pageModuleUsesStaticLoader,
} from "./staticLoaderData.js"
import {
  canStreamPageLoad,
  readLoaderFallback,
  readPageLoadExport,
  type KiruLoader,
  type PageProps,
} from "./loaders.js"
import {
  createDynamicHeadContext,
  isAsyncPageHead,
  mergeRouteAndPageHead,
  readPageHeadExport,
  resolveMergedRoutePageHead,
  resolveMergedRoutePageHeadSync,
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
  type PrerenderCacheStore,
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
import type { KiruDeployTarget } from "@kirujs/runtime"
import { isEdgeDeployTarget } from "@kirujs/runtime"
import {
  makeKiruContextToken,
  makeKiruContextTokenAsync,
  createRemoteActionHandler,
} from "../remote/index.js"
import { runWithSsrRequestContext } from "../remote/action.js"
import {
  buildMiddlewareTo,
  buildMatchSegments,
} from "./navigation.js"
import { mergeRouteMeta } from "./routeMeta.js"
import {
  runRouteMiddleware,
  toMiddlewareRedirect,
} from "./routeMiddleware.js"
import type { RouteMiddleware } from "./types.js"
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
  secret: string,
  deployTarget: KiruDeployTarget = "node"
): string {
  if (!ctx) return ""
  if (isEdgeDeployTarget(deployTarget)) {
    throw new Error(
      "[kiru] serializeKiruRequestTokenScript is synchronous and unsupported on cloudflare; use serializeKiruRequestTokenScriptAsync"
    )
  }
  const token = makeKiruContextToken(ctx, secret)
  return `<script type="application/json" k-request-token>${token}</script>`
}

/** Web Crypto token script for edge runtimes (Workers). */
export async function serializeKiruRequestTokenScriptAsync(
  ctx: CustomRequestContext | null | undefined,
  secret: string
): Promise<string> {
  if (!ctx) return ""
  const token = await makeKiruContextTokenAsync(
    ctx as Record<string, unknown>,
    secret
  )
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
  /**
   * Deploy target — controls ISR, disk prerender, and action token signing.
   * @default "node"
   * @see docs/router/deploy-runtimes.md
   */
  deployTarget?: KiruDeployTarget
  /** Global route middleware (SSR + CSR). */
  routeMiddleware?: RouteMiddleware[]
}

function engine(options: CreateRendererOptions & { stream: boolean }) {
  const {
    manifest,
    compiledTemplate,
    actionsSecret,
    handleRemoteAction,
    globalMiddleware,
  } = prepareRenderer(options)
  const pathPolicy = resolvePathPolicy(options.pathPolicy)
  const i18nConfig = options.i18n

  let prerenderPathSet: Promise<ReadonlySet<string>> | undefined
  const getPrerenderPathSet = (): Promise<ReadonlySet<string>> => {
    if (!prerenderPathSet) {
      prerenderPathSet = generatePublicStaticPaths(
        manifest,
        pathPolicy,
        undefined,
        i18nConfig ? getI18nLocaleRouting(i18nConfig) : undefined
      ).then((paths) => new Set(paths))
    }
    return prerenderPathSet
  }

  const deployTarget = options.deployTarget ?? "node"
  const edgeTarget = isEdgeDeployTarget(deployTarget)
  const prerenderedHtmlDir = edgeTarget
    ? undefined
    : options.prerenderedHtmlDir

  let prerenderCacheInstance = edgeTarget ? undefined : options.prerenderCache
  let ensurePrerenderCache: Promise<PrerenderCacheStore | undefined> | undefined

  const getPrerenderCache = async (): Promise<
    PrerenderCacheStore | undefined
  > => {
    if (edgeTarget) return undefined
    if (prerenderCacheInstance) return prerenderCacheInstance
    if (!prerenderedHtmlDir) return undefined
    if (!ensurePrerenderCache) {
      ensurePrerenderCache = getPrerenderPathSet().then((staticPaths) => {
        prerenderCacheInstance = diskPrerenderCache({
          clientDir: prerenderedHtmlDir,
          pathPolicy,
          staticPaths,
        })
        setGlobalPrerenderCache(prerenderCacheInstance)
        return prerenderCacheInstance
      })
    }
    return ensurePrerenderCache
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
      !edgeTarget &&
      (options.prerenderCache || prerenderedHtmlDir)
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
          const prerenderCache = await getPrerenderCache()
          const prerendered = await tryServePrerenderedFromDisk(
            requestOrUrl,
            url,
            {
              prerenderedHtmlDir: prerenderCache ? undefined : prerenderedHtmlDir,
              deployTarget,
              prerenderCache,
              stream: options.stream,
              pathPolicy,
              getStaticPathSet: getPrerenderPathSet,
              actionsSecret: actionsSecret ?? "",
              onRegenerate: async (pathname) => {
                const cache = await getPrerenderCache()
                if (!cache) return
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
                  await cache.set(pathname, entry)
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
    const renderSignal = loaderSignalFromRequest(
      typeof requestOrUrl === "object" ? requestOrUrl : undefined
    )

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
        typeof requestOrUrl === "object" ? requestOrUrl : undefined,
        globalMiddleware,
        { enableStreamingLoad: options.stream }
      )
      if (!prepared) return null

      if (isPrepareError(prepared)) {
        const errorHeaders = {
          ...DEFAULT_HEADERS,
          ...prepared.headers,
        }
        if (options.stream) {
          return {
            kind: "string" as const,
            result: {
              status: prepared.status,
              headers: errorHeaders,
              body: prepared.body ?? "",
            },
          }
        }
        return {
          kind: "string" as const,
          result: {
            status: prepared.status,
            headers: errorHeaders,
            body: prepared.body ?? "",
          },
        }
      }

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

      const actionTokenInsertion =
        actionsSecret && requestContext
          ? await buildActionTokenInsertion(
              requestContext,
              actionsSecret,
              deployTarget
            )
          : ""

      if (options.stream) {
        // Assemble the full static document (prefix + shell + suffix) in a
        // single `onShellReady` flush so the browser sees `</html>` before
        // the streamed data scripts arrive. That lets `DOMContentLoaded`
        // fire on the closing tag (rather than on connection close), so an
        // implicitly-deferred `<script type="module">` entry tag hydrates
        // immediately instead of waiting on the slowest in-flight resource.
        const decorateDocument = (document: DocumentHead) => {
          if (actionTokenInsertion) document.headHtml += actionTokenInsertion
        }

        const stream = runWithSsrRequestContext(
          requestContext,
          renderSignal,
          () =>
            routeMatch
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
              : renderUnmatchedAppStream(
                  app,
                  requestContext,
                  compiledTemplate,
                  decorateDocument
                )
        )

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
            renderSignal,
            pathPolicy,
            serializedPageData,
            prepared.streamHeadMeta,
            prepared.i18nPayload
          )
        : runWithSsrRequestContext(requestContext, renderSignal, () => ({
            body: renderToString(app),
            document: {
              headHtml: serializeRequestContextScript(requestContext),
              bodyEndHtml: "",
              headEndHtml: "",
            } satisfies DocumentHead,
          }))

      if (actionTokenInsertion) document.headHtml += actionTokenInsertion

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
      if (isAbortError(caught)) return null
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
        const recoveryTokenInsertion =
          actionsSecret && recoveryCtx
            ? await buildActionTokenInsertion(
                recoveryCtx,
                actionsSecret,
                deployTarget
              )
            : ""

        if (options.stream) {
          const document: DocumentHead = {
            headHtml: serializeRequestContextScript(recoveryCtx),
          }
          if (recoveryTokenInsertion) document.headHtml += recoveryTokenInsertion
          const stream = runWithSsrRequestContext(recoveryCtx, renderSignal, () =>
            renderToReadableStream(recoveryApp, {
              onShellReady: (shell, controller) =>
                enqueueTemplatedShell(controller, {
                  compiledTemplate,
                  headHtml: document.headHtml,
                  shell,
                }),
            })
          )
          return {
            kind: "stream" as const,
            result: {
              status: 500,
              headers: { ...DEFAULT_HEADERS, "transfer-encoding": "chunked" },
              body: stream,
            },
          }
        }

        const body = runWithSsrRequestContext(recoveryCtx, renderSignal, () =>
          renderToString(recoveryApp)
        )

        const documentHead: DocumentHead = {
          headHtml: serializeRequestContextScript(recoveryCtx),
        }
        if (recoveryTokenInsertion) documentHead.headHtml += recoveryTokenInsertion
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
  renderSignal: AbortSignal,
  pathPolicy?: RouterPathPolicy,
  pageData?: unknown,
  streamHeadMeta?: RouteHeadMeta,
  i18nPayload?: HydratedI18nPayload
): Promise<{ body: string; document: DocumentHead }> {
  let body = ""
  const prev = renderMode.current
  renderMode.current = "stream"
  try {
    runWithSsrRequestContext(requestContext, renderSignal, () => {
      headlessRender(
        {
          write(chunk) {
            body += chunk
          },
        },
        Fragment({ children: app })
      )
    })
  } finally {
    renderMode.current = prev
  }

  const resolvedMeta = mergeImagePreloadsIntoHead(
    streamHeadMeta ??
      mergeRouteAndPageHead(match.route.head, undefined)
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
    localeRouting?: import("./i18n/localeRouting.js").I18nLocaleRouting
  }
) {
  const staticRouter = createStaticRouter({
    manifest,
    pathname,
    query: options?.url?.query ?? {},
    hash: options?.url?.hash ?? "",
    pathPolicy: options?.pathPolicy,
    localeRouting: options?.localeRouting,
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
    /** Public URL path for static loader capture (locale prefix included). */
    publicPath?: string
    signal?: AbortSignal
  }
): Promise<{ body: string; document: DocumentHead; pageData?: unknown }> {
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
    publicPath?: string
    signal?: AbortSignal
  }
): Promise<{ body: string; document: DocumentHead; pageData?: unknown }> {
  const renderSignal = options?.signal ?? loaderSignalFromRequest(undefined)
  throwIfAborted(renderSignal)

  // Prerender paths are pathname-only (no query string at build time).
  const pageMod = await match.route.component()
  throwIfAborted(renderSignal)
  const locale = options?.locale ?? null
  const loaderCtx = buildLoaderContext({
    params: match.params,
    pathname: match.pathname,
    search: "",
    hash: "",
    query: {},
    context: {},
    meta: mergeRouteMeta(match),
    routeId: match.route.id,
    signal: renderSignal,
    ...(options?.i18n && locale
      ? loaderI18nFields(options.i18n, locale)
      : {}),
  })
  const resolved = await resolvePagePropsFromModule(pageMod, loaderCtx)
  throwIfAborted(renderSignal)
  if (resolved.discarded) {
    throw new DOMException("Prerender aborted", "AbortError")
  }
  const pageProps = resolved.props
  const streamHeadMeta = await resolveStreamHeadMeta(
    match,
    pageMod,
    loaderCtx,
    pageProps as PageProps<KiruLoader<unknown>>
  )
  throwIfAborted(renderSignal)
  const i18nPayload =
    options?.i18n && locale
      ? {
          locale,
          data: await loadI18nMessages(options.i18n, locale),
          locales: options.i18n.locales,
          defaultLocale: options.i18n.default,
        }
      : undefined
  throwIfAborted(renderSignal)
  const localeRouting =
    options?.i18n && locale ? getI18nLocaleRouting(options.i18n) : undefined
  const { layoutModules, routeModule } = await loadRouteTree(match)
  throwIfAborted(renderSignal)
  const app = buildAppElement(
    match.pathname,
    match.params,
    layoutModules,
    routeModule,
    manifest,
    {},
    pageProps,
    { pathPolicy, i18n: i18nPayload, localeRouting }
  )
  const pageData = serializedDataFromPageProps(pageProps)
  if (
    options?.publicPath &&
    pageData !== undefined &&
    pageModuleUsesStaticLoader(pageMod)
  ) {
    emitStaticLoaderPrerenderCapture({
      routeId: match.route.id,
      pathname: options.publicPath,
      pageData,
    })
  }
  const rendered = await renderStringWithDocument(
    app,
    match,
    {},
    renderSignal,
    pathPolicy,
    pageData,
    streamHeadMeta,
    i18nPayload
  )
  throwIfAborted(renderSignal)
  return { ...rendered, pageData }
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

type PrepareError = {
  kind: "error"
  status: number
  body?: string
  headers?: Record<string, string>
}

type PrepareAppResult = PreparedApp | PrepareRedirect | PrepareError | null

function isPrepareRedirect(
  p: Exclude<PrepareAppResult, null>
): p is PrepareRedirect {
  return "kind" in p && p.kind === "redirect"
}

function isPrepareError(
  p: Exclude<PrepareAppResult, null>
): p is PrepareError {
  return "kind" in p && p.kind === "error"
}

const MAX_SSR_MIDDLEWARE_REDIRECTS = 16

async function resolveStreamHeadMeta(
  match: RouteMatch,
  pageMod: unknown,
  loaderCtx: ReturnType<typeof buildLoaderContext>,
  pageProps?: PageProps<KiruLoader<unknown>>
): Promise<RouteHeadMeta> {
  const pageHead = readPageHeadExport(pageMod)
  const headCtx = createDynamicHeadContext(loaderCtx, pageMod, pageProps)
  return isAsyncPageHead(pageHead)
    ? resolveMergedRoutePageHead(match.route.head, pageHead, headCtx)
    : resolveMergedRoutePageHeadSync(match.route.head, pageHead, headCtx)
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
  const localeRouting = getI18nLocaleRouting(i18n)
  const detected = detectLocaleFromRequest(request, i18n)
  const target = formatPublicPathname("/", detected, localeRouting, pathPolicy)
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
  request?: Request,
  globalMiddleware: RouteMiddleware[] = [],
  renderOpts: { enableStreamingLoad?: boolean } = {}
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
    const localeRouting = getI18nLocaleRouting(i18n)
    const split = splitAppPathnameDetailed(rawPath, localeRouting)
    if (split.kind === "invalid-locale") {
      if (shouldRejectInvalidLocale(localeRouting)) {
        logicalPath = split.pathname
        locale = split.locale
      } else {
        const location = resolveInvalidLocaleRedirect(split, localeRouting, pathPolicy)
        return { kind: "redirect", location }
      }
    } else {
      logicalPath = split.pathname
      locale = split.locale
    }
  }
  const requestedPathname = formatPathname(logicalPath, pathPolicy)
  let path = requestedPathname

  for (let depth = 0; depth < MAX_SSR_MIDDLEWARE_REDIRECTS; depth++) {
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

    const requestContext = (ctx?.context ?? {}) as CustomRequestContext
    const href = `${path}${requestUrl.search}${requestUrl.hash}`
    const segments = buildMatchSegments(routeMatch)
    const mwTo = buildMiddlewareTo(
      {
        pathname: routeMatch.pathname,
        hash: requestUrl.hash,
        query: requestUrl.query,
        href,
      },
      routeMatch,
      segments
    )
    const mw = await runRouteMiddleware({
      to: mwTo,
      from: null,
      meta: mergeRouteMeta(routeMatch),
      context: requestContext,
      request,
      globalMiddleware,
      match: routeMatch,
    })
    if (mw.type === "redirect") {
      path = toPathname(toMiddlewareRedirect(mw.to).path)
      continue
    }
    if (mw.type === "abort") return null
    if (mw.type === "error") {
      return {
        kind: "error",
        status: mw.status,
        body: mw.body,
        headers: mergeResponseHeaders(ctx?.headers),
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

    const renderSignal = loaderSignalFromRequest(request)
    throwIfAborted(renderSignal)

    const loaderCtx = buildLoaderContext({
      params: searchCheck.params,
      pathname: routeMatch.pathname,
      search: requestUrl.search,
      hash: requestUrl.hash,
      query: requestUrl.query,
      validatedQuery: searchCheck.validatedQuery,
      context: requestContext,
      meta: mergeRouteMeta(routeMatch),
      routeId: routeMatch.route.id,
      request,
      signal: renderSignal,
      ...loaderI18nFields(i18n, locale),
    })

    const { layoutModules, routeModule: rawRouteModule } =
      await loadRouteTree(routeMatch)
    throwIfAborted(renderSignal)

    const pageMod = rawRouteModule
    const pageHead = readPageHeadExport(pageMod)
    const load = readPageLoadExport(pageMod)
    const asyncHead = isAsyncPageHead(pageHead)
    const streamPageLoad =
      !!renderOpts.enableStreamingLoad &&
      canStreamPageLoad(load) &&
      !asyncHead

    let pageProps: Record<string, unknown>
    let pagePropsPromise: Promise<Record<string, unknown>> | undefined

    const i18nMessagesPromise =
      i18n && locale ? loadI18nMessages(i18n, locale) : Promise.resolve(undefined)

    let streamHeadMeta: Awaited<ReturnType<typeof resolveStreamHeadMeta>>
    let i18nMessages: Awaited<typeof i18nMessagesPromise>
    if (streamPageLoad) {
      // Loader data is streamed via `resource()` / `__$k_data` in the load gate;
      // do not await `resolvePagePropsFromModule` here or the shell blocks on load.
      pageProps = {}
      ;[streamHeadMeta, i18nMessages] = await Promise.all([
        resolveStreamHeadMeta(routeMatch, pageMod, loaderCtx, undefined),
        i18nMessagesPromise,
      ])
    } else {
      const resolved = await resolvePagePropsFromModule(pageMod, loaderCtx, {
        routeId: routeMatch.route.id,
      })
      if (resolved.discarded) return null
      throwIfAborted(renderSignal)
      pageProps = resolved.props
      ;[streamHeadMeta, i18nMessages] = await Promise.all([
        resolveStreamHeadMeta(
          routeMatch,
          pageMod,
          loaderCtx,
          pageProps as PageProps<KiruLoader<unknown>>
        ),
        i18nMessagesPromise,
      ])
    }
    throwIfAborted(renderSignal)

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
      i18n && locale && i18nMessages !== undefined
        ? {
            locale,
            data: i18nMessages,
            locales: i18n.locales,
            defaultLocale: i18n.default,
          }
        : undefined
    const localeRouting =
      i18n && locale ? getI18nLocaleRouting(i18n) : undefined

    const app = buildAppElement(
      routeMatch.pathname,
      routeMatch.params,
      layoutModules,
      routeModule,
      manifest,
      requestContext,
      pageProps as LeafRouteProps,
      { url: requestUrl, pathPolicy, i18n: i18nPayload, localeRouting }
    )

    const pagePropsForMeta =
      asyncHead || !streamPageLoad
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
  const baseHeadMeta =
    opts.streamHeadMeta ??
    mergeRouteAndPageHead(match.route.head, undefined)
  const resolveHeadMeta = () => mergeImagePreloadsIntoHead(baseHeadMeta)
  const mayEarlyFlush =
    !!opts.earlyFlushHead &&
    opts.compiledTemplate?.headBeforeBody === true
  let streamedHeadEarly = false

  const headWithoutPageData = () =>
    buildStreamDocumentHead(resolveHeadMeta(), pathname, requestContext, {
      decorateDocument: opts.decorateDocument,
    })

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
        resolveHeadMeta(),
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
  return stream
}

function renderUnmatchedAppStream(
  app: JSX.Element,
  requestContext: CustomRequestContext,
  compiledTemplate: CompiledRouteHtmlTemplate | null,
  decorateDocument: (document: DocumentHead) => void
): ReadableStream<string> {
  const document: DocumentHead = {
    headHtml: serializeRequestContextScript(requestContext),
  }
  decorateDocument(document)
  const stream = renderToReadableStream(app, {
    onShellReady: (shell, controller) =>
      enqueueTemplatedShell(controller, {
        compiledTemplate,
        headHtml: document.headHtml,
        shell,
      }),
  })
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
    globalMiddleware: options.routeMiddleware ?? [],
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

async function buildActionTokenInsertion(
  requestContext: CustomRequestContext,
  secret: string,
  deployTarget: KiruDeployTarget
): Promise<string> {
  const tag = isEdgeDeployTarget(deployTarget)
    ? await serializeKiruRequestTokenScriptAsync(requestContext, secret)
    : serializeKiruRequestTokenScript(requestContext, secret, deployTarget)
  return tag ? `\n    ${tag}` : ""
}

function toPathname(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname
  } catch {
    return url
  }
}
