import {
  compileRouteTree,
  generatePublicStaticPaths,
  matchRoute,
} from "./manifest.js"
import { splitAppPathname } from "./i18n/routing.js"
import type { InternationalizationConfig } from "./i18n/createI18nConfig.js"
import { getI18nLocaleRouting } from "./i18n/localeRouting.js"
import type { RouterPathPolicy } from "./pathPolicy.js"
import { createRenderer, renderMatchToStaticHtml } from "./renderer.js"
import type {
  DocumentHead,
  RouteManifest,
  RouteTreeDefinition,
} from "./types.js"

export interface StaticRouteOutput {
  path: string
  /** App HTML only (mount target inner HTML). */
  body: string
  /** Full HTML document when `htmlTemplate` is provided. */
  html?: string
  document: DocumentHead
  /** Compiled route id (`route:N`) for static loader data indexing. */
  routeId: string
  /** Serialized `staticLoader` / loader props when present. */
  pageData?: unknown
}

const DEFAULT_MAX_CONCURRENT_RENDERS = 10

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  if (concurrency === Infinity) {
    return Promise.all(items.map((item, index) => fn(item, index)))
  }

  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++
      if (index >= items.length) return
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  )
  return results
}

export async function prerenderStaticRoutes({
  routes,
  htmlTemplate,
  pathPolicy,
  maxConcurrentRenders = DEFAULT_MAX_CONCURRENT_RENDERS,
  i18n,
}: {
  routes: RouteTreeDefinition | RouteManifest
  htmlTemplate?: string
  pathPolicy?: RouterPathPolicy
  /** @default 10 */
  maxConcurrentRenders?: number
  /**
   * Locale-aware prerender (per-locale public URLs, messages, URL split).
   * Routing prefixes are derived via {@link getI18nLocaleRouting}.
   */
  i18n?: InternationalizationConfig<readonly string[], unknown>
}): Promise<StaticRouteOutput[]> {
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const localeRouting = i18n ? getI18nLocaleRouting(i18n) : undefined
  const paths = await generatePublicStaticPaths(
    manifest,
    pathPolicy,
    undefined,
    localeRouting
  )
  const renderer =
    htmlTemplate !== undefined
      ? createRenderer({
          routes: manifest,
          htmlTemplate,
          pathPolicy,
          i18n,
        })
      : i18n
        ? createRenderer({ routes: manifest, pathPolicy, i18n })
        : null

  const renderedPaths = await mapWithConcurrency(
    paths,
    maxConcurrentRenders,
    async (publicPath) => {
      const logicalPath = localeRouting
        ? splitAppPathname(publicPath, localeRouting).pathname
        : publicPath
      const routeMatch = matchRoute(manifest, logicalPath, pathPolicy)
      if (!routeMatch) return null

      const locale = localeRouting
        ? splitAppPathname(publicPath, localeRouting).locale
        : null
      const staticRenderOpts =
        i18n && locale
          ? { i18n, locale }
          : undefined

      if (renderer) {
        const rendered = await renderer.render(publicPath)
        if (!rendered || typeof rendered.body !== "string") return null
        const { body, document, pageData } = await renderMatchToStaticHtml(
          manifest,
          routeMatch,
          pathPolicy,
          { ...staticRenderOpts, publicPath }
        )
        return {
          path: publicPath,
          body,
          document,
          html: rendered.body,
          routeId: routeMatch.route.id,
          ...(pageData !== undefined ? { pageData } : {}),
        }
      }

      const { body, document, pageData } = await renderMatchToStaticHtml(
          manifest,
          routeMatch,
          pathPolicy,
          { ...staticRenderOpts, publicPath }
        )
        return {
          path: publicPath,
          body,
          document,
          routeId: routeMatch.route.id,
          ...(pageData !== undefined ? { pageData } : {}),
        }
    }
  )

  const outputs: StaticRouteOutput[] = renderedPaths.filter(
    (output): output is StaticRouteOutput => output !== null
  )

  if (manifest.rootHasNotFound) {
    const nfPath = "/__kiru_ssg_not_found__"
    const inner = createRenderer({ routes: manifest, i18n })
    const frag = await inner.render(nfPath)
    if (frag && typeof frag.body === "string") {
      const doc: DocumentHead = { headHtml: "", title: "Not Found" }
      if (renderer) {
        const full = await renderer.render(nfPath)
        if (full && typeof full.body === "string") {
          outputs.push({
            path: "/404",
            body: frag.body,
            document: doc,
            html: full.body,
            routeId: "",
          })
        }
      } else {
        outputs.push({
          path: "/404",
          body: frag.body,
          document: doc,
          routeId: "",
        })
      }
    }
  }

  return outputs
}
