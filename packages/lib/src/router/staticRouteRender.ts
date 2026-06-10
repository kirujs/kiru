import {
  getI18nLocaleRouting,
  loaderI18nFields,
  loadI18nMessages,
  type InternationalizationConfig,
} from "./i18n/index.js"
import { mergeRouteMeta } from "./routeMeta.js"
import type { RouterPathPolicy } from "./pathPolicy.js"
import { loadRouteTree } from "./routeTree.js"
import type { DocumentHead, RouteManifest, RouteMatch } from "./types.js"
import { buildLoaderContext } from "./runPageLoad.js"
import {
  loaderSignalFromRequest,
  throwIfAborted,
} from "./navigationScope.js"
import type { KiruLoader, PageProps } from "./loaders.js"
import {
  emitStaticLoaderPrerenderCapture,
  pageModuleUsesStaticLoader,
} from "./staticLoaderData.js"
import { resolvePagePropsFromModule } from "./runPageLoad.js"
import { resolveStreamHeadMeta } from "./prepareAppForUrl.js"
import { serializedDataFromPageProps } from "./rendererStream.js"
import { buildAppElement, renderStringWithDocument } from "./ssrAppBuild.js"

/** Shared SSG / SSR string render for a matched route. */
export async function renderMatchToStaticHtml(
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
  return renderMatchToStaticHtmlInner(manifest, match, pathPolicy, options)
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
          defaultLocale: options.i18n.defaultLocale,
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
    { pathPolicy, i18n: i18nPayload, localeRouting, match }
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
