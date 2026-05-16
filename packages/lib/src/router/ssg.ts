import {
  compileRouteTree,
  generateStaticPaths,
  matchRoute,
} from "./manifest.js"
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
}: {
  routes: RouteTreeDefinition | RouteManifest
  htmlTemplate?: string
  pathPolicy?: RouterPathPolicy
  /** @default 10 */
  maxConcurrentRenders?: number
}): Promise<StaticRouteOutput[]> {
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const paths = await generateStaticPaths(manifest, pathPolicy)
  const renderer =
    htmlTemplate !== undefined
      ? createRenderer({
          routes: manifest,
          htmlTemplate,
          pathPolicy,
        })
      : null

  const renderedPaths = await mapWithConcurrency(
    paths,
    maxConcurrentRenders,
    async (path) => {
      const routeMatch = matchRoute(manifest, path, pathPolicy)
      if (!routeMatch) return null

      if (renderer) {
        const rendered = await renderer.render(path)
        if (!rendered || typeof rendered.body !== "string") return null
        const { body, document } = await renderMatchToStaticHtml(
          manifest,
          routeMatch,
          pathPolicy
        )
        return { path, body, document, html: rendered.body }
      }

      const { body, document } = await renderMatchToStaticHtml(
        manifest,
        routeMatch,
        pathPolicy
      )
      return { path, body, document }
    }
  )

  const outputs: StaticRouteOutput[] = renderedPaths.filter(
    (output): output is StaticRouteOutput => output !== null
  )

  if (manifest.rootHasNotFound) {
    const nfPath = "/__kiru_ssg_not_found__"
    const inner = createRenderer({ routes: manifest })
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
