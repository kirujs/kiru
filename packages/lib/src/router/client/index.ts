// initClient({ dir, baseUrl, pages, layouts })

import { createElement } from "../../element.js"
import { hydrate } from "../../ssr/client.js"
import { FileRouter } from "../fileRouter.js"
import { matchLayouts, matchRoute } from "../utils/index.js"
import type { FormattedViteImportMap } from "../types.internal"
import type { FileRouterConfig, FileRouterPreloadConfig } from "../types"

interface InitClientOptions {
  dir: string
  baseUrl: string
  pages: FormattedViteImportMap
  layouts: FormattedViteImportMap
}

export async function initClient(options: InitClientOptions) {
  const preloaded = await preparePreloadConfig(options)
  const { dir, baseUrl, pages, layouts } = options
  const config: FileRouterConfig = { dir, baseUrl, pages, layouts, preloaded }
  hydrate(createElement(FileRouter, { config }), document.body)
}

async function preparePreloadConfig(
  options: InitClientOptions
): Promise<FileRouterPreloadConfig> {
  const u = new URL(window.location.pathname, "http://localhost")
  const routeMatch = matchRoute(
    options.pages,
    u.pathname.split("/").filter(Boolean)
  )
  if (routeMatch === null) {
    throw new Error("todo: handle 404")
  }

  const layoutEntries = matchLayouts(options.layouts, routeMatch.routeSegments)

  const [page, ...layouts] = await Promise.all([
    routeMatch.pageEntry.load(),
    ...layoutEntries.map((e) => e.load()),
  ])

  let pageProps = {}
  try {
    const script = document.querySelector("script[x-page-props]")!
    pageProps = JSON.parse(script.textContent)
    script.remove()
  } catch (error) {
    pageProps = {}
  }

  return {
    pages: options.pages,
    layouts: options.layouts,
    page: page,
    pageProps: pageProps,
    pageLayouts: layouts,
    params: routeMatch.params,
    query: {},
    route: routeMatch.route,
  }
}
