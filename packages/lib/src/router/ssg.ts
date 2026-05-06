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
    const match = matchRoute(manifest, path)
    if (!match) continue
    const { body, document } = await renderMatchToStaticHtml(manifest, match)
    let html: string | undefined
    if (renderer) {
      const rendered = await renderer.render(path)
      if (rendered && typeof rendered.body === "string") {
        html = rendered.body
      }
    }
    outputs.push({ path, body, document, html })
  }
  return outputs
}
