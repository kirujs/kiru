import { __DEV__ } from "../env.js"
import { renderToString } from "../renderToString.js"
import { runWithImagePreloadRegistry } from "../image/preloadRegistry.js"
import {
  compileRouteTree,
  generatePublicStaticPaths,
  matchRoute,
} from "./manifest.js"
import { tryServePrerenderedFromDisk } from "./prerenderServe.js"
import {
  compileRouteHtmlTemplate,
  renderCompiledTemplate,
  validateRouteHtmlTemplate,
} from "./htmlTemplate.js"
import { serializeRequestContextScript } from "./requestContext.js"
import {
  getI18nLocaleRouting,
  type InternationalizationConfig,
} from "./i18n/index.js"
import { createLoaderHandler } from "./loaderRegistry.js"
import { loaderSignalFromRequest } from "./navigationScope.js"
import { readRouteISRExport } from "./routeRevalidate.js"
import {
  diskPrerenderCache,
  setGlobalPrerenderCache,
  type PrerenderCacheStore,
} from "./prerenderCache.js"
import {
  prepareAppForUrl,
  isPrepareRedirect,
  isPrepareError,
  tryLocaleDetectionRedirect,
  localeDetectionRedirectRenderHit,
  DEFAULT_SSR_HEADERS,
  type RenderRequestContext,
} from "./prepareAppForUrl.js"
import { renderSsrErrorRecovery } from "./renderErrorRecovery.js"
import { createIsrRegenerateHandler } from "./prerenderRegenerate.js"
import {
  renderStreamForRouteMatch,
  renderUnmatchedAppStream,
} from "./rendererStream.js"
import { renderStringWithDocument } from "./ssrAppBuild.js"
import {
  pathnameForMatch,
  resolvePathPolicy,
  type RouterPathPolicy,
} from "./pathPolicy.js"
import type {
  CustomRequestContext,
  DocumentHead,
  RenderResult,
  RouteManifest,
  RouteMatch,
  RouteTreeDefinition,
  StreamRenderResult,
} from "./types.js"
import type { KiruDeployTarget } from "@kirujs/runtime"
import { isEdgeDeployTarget } from "@kirujs/runtime"
import {
  makeKiruContextToken,
  makeKiruContextTokenAsync,
  createRemoteActionHandler,
} from "../remote/index.js"
import { runWithSsrRequestContext } from "../remote/action.js"
import { toPathname } from "./requestUrl.js"

export {
  buildRoutedSubtree,
  loadErrorRouteTree,
  loadNotFoundRouteTree,
  loadRootErrorRouteTree,
  loadRouteTree,
} from "./routeTree.js"
export { renderMatchToStaticHtml } from "./staticRouteRender.js"
export type { RenderRequestContext } from "./prepareAppForUrl.js"

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
}

function engine(options: CreateRendererOptions & { stream: boolean }) {
  const {
    manifest,
    compiledTemplate,
    actionsSecret,
    handleRemoteAction,
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

  const bypassPrerenderServe = { current: false }

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
        pathPolicy,
        url
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
      !bypassPrerenderServe.current &&
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
              localeRouting: i18nConfig
                ? getI18nLocaleRouting(i18nConfig)
                : undefined,
              getStaticPathSet: getPrerenderPathSet,
              actionsSecret: actionsSecret ?? "",
              onRegenerate: createIsrRegenerateHandler({
                manifest,
                pathPolicy,
                renderCore,
                getPrerenderCache,
                bypassPrerenderServe,
              }),
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
        { enableStreamingLoad: options.stream }
      )
      if (!prepared) return null

      if (isPrepareError(prepared)) {
        const errorHeaders = {
          ...DEFAULT_SSR_HEADERS,
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
          ...DEFAULT_SSR_HEADERS,
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
                  renderSignal,
                })
              : renderUnmatchedAppStream(
                  app,
                  requestContext,
                  compiledTemplate,
                  decorateDocument,
                  renderSignal
                )
        )

        return {
          kind: "stream" as const,
          result: {
            status: routeMatch ? responseStatus : 404,
            headers: {
              ...DEFAULT_SSR_HEADERS,
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
          headers: { ...DEFAULT_SSR_HEADERS, ...responseHeaders },
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
      return renderSsrErrorRecovery({
        caught,
        url,
        manifest,
        pathPolicy,
        requestedPathname: requestedPathForErrors,
        failureContext,
        fallbackContext: (ctx?.context ?? {}) as CustomRequestContext,
        renderSignal,
        stream: options.stream,
        compiledTemplate,
        actionsSecret: actionsSecret ?? undefined,
        deployTarget,
      })
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

function prepareRenderer(options: CreateRendererOptions) {
  const { routes, htmlTemplate, actions } = options
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const compiledTemplate =
    htmlTemplate !== undefined ? compileRouteHtmlTemplate(htmlTemplate) : null
  if (__DEV__ && htmlTemplate !== undefined) {
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

