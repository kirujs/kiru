import { compileRouteTree, generateStaticPaths, matchRoute } from "./manifest.js"
import { createRenderer, renderMatchToStaticHtml } from "./renderer.js"
import type { DocumentHead, RouteManifest, RouteTreeDefinition } from "./types.js"

export interface StaticRouteOutput {
  path: string
  /** App HTML only (mount target inner HTML). */
  body: string
  /** Full HTML document when `htmlTemplate` is provided. */
  html?: string
  document: DocumentHead
}

export async function prerenderStaticRoutes({
  routes,
  htmlTemplate,
}: {
  routes: RouteTreeDefinition | RouteManifest
  htmlTemplate?: string
}): Promise<StaticRouteOutput[]> {
  const manifest = "routes" in routes ? routes : compileRouteTree(routes)
  const paths = await generateStaticPaths(manifest)
  const renderer =
    htmlTemplate !== undefined
      ? createRenderer({
          routes: manifest,
          htmlTemplate,
        })
      : null

  const outputs: StaticRouteOutput[] = []
  for (const path of paths) {
    const routeMatch = matchRoute(manifest, path)
    if (!routeMatch) continue

    if (renderer) {
      const rendered = await renderer.render(path)
      if (!rendered || typeof rendered.body !== "string") continue
      const { body, document } = await renderMatchToStaticHtml(
        manifest,
        routeMatch,
      )
      outputs.push({ path, body, document, html: rendered.body })
      continue
    }

    const { body, document } = await renderMatchToStaticHtml(
      manifest,
      routeMatch,
    )
    outputs.push({ path, body, document })
  }

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
