import {
  compileRouteTree,
  generatePublicStaticPaths,
  matchRoute,
} from "./manifest.js"
import type { SiteLocales } from "./localePolicy.js"
import { splitAppPathname } from "./i18n/routing.js"
import type { InternationalizationConfig } from "./i18n/createI18nConfig.js"
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
  siteLocales,
  i18n,
}: {
  routes: RouteTreeDefinition | RouteManifest
  htmlTemplate?: string
  pathPolicy?: RouterPathPolicy
  /** @default 10 */
  maxConcurrentRenders?: number
  /** When set, prerender each locale's public URL. */
  siteLocales?: SiteLocales
  /** Enables locale-aware SSR during prerender (messages + URL split). */
  i18n?: InternationalizationConfig<readonly string[], unknown>
}): Promise<StaticRouteOutput[]> {
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const paths = await generatePublicStaticPaths(
    manifest,
    pathPolicy,
    undefined,
    siteLocales
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
      const logicalPath = siteLocales
        ? splitAppPathname(publicPath, siteLocales).pathname
        : publicPath
      const routeMatch = matchRoute(manifest, logicalPath, pathPolicy)
      if (!routeMatch) return null

      const locale = siteLocales
        ? splitAppPathname(publicPath, siteLocales).locale
        : null
      const staticRenderOpts =
        i18n && locale
          ? { i18n, locale }
          : undefined

      if (renderer) {
        const rendered = await renderer.render(publicPath)
        if (!rendered || typeof rendered.body !== "string") return null
        const { body, document } = await renderMatchToStaticHtml(
          manifest,
          routeMatch,
          pathPolicy,
          staticRenderOpts
        )
        return { path: publicPath, body, document, html: rendered.body }
      }

      const { body, document } = await renderMatchToStaticHtml(
        manifest,
        routeMatch,
        pathPolicy,
        staticRenderOpts
      )
      return { path: publicPath, body, document }
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
          })
        }
      } else {
        outputs.push({ path: "/404", body: frag.body, document: doc })
      }
    }
  }

  return outputs
}
