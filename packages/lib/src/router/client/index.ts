// initClient({ dir, baseUrl, pages, layouts })

import { createElement } from "../../element.js"
import { hydrate } from "../../ssr/client.js"
import { FileRouter } from "../fileRouter.js"
import { matchLayouts, matchRoute, parseQuery } from "../utils/index.js"
import type { FormattedViteImportMap, PageModule } from "../types.internal"
import type {
  ErrorPageProps,
  FileRouterConfig,
  FileRouterPreloadConfig,
} from "../types"
import { fileRouterInstance, fileRouterRoute } from "../globals.js"
import { FileRouterController } from "../fileRouterController.js"
import { FileRouterDataLoadError } from "../errors.js"

interface InitClientOptions {
  dir: string
  baseUrl: string
  pages: FormattedViteImportMap
  layouts: FormattedViteImportMap
}

export async function initClient(options: InitClientOptions) {
  const { dir, baseUrl, pages, layouts } = options
  const config: FileRouterConfig = {
    dir,
    baseUrl,
    pages,
    layouts,
    preloaded: await preparePreloadConfig(options),
    transition: true,
  }
  hydrate(createElement(FileRouter, { config }), document.body)
}

async function preparePreloadConfig(
  options: InitClientOptions
): Promise<FileRouterPreloadConfig> {
  let pageProps = {}
  let url = new URL(window.location.pathname, "http://localhost")
  let routeMatch = matchRoute(
    options.pages,
    url.pathname.split("/").filter(Boolean)
  )

  if (routeMatch === null) {
    pageProps = { source: { path: url.pathname } } satisfies ErrorPageProps
    url = new URL("/404", "http://localhost")
    routeMatch = matchRoute(
      options.pages,
      url.pathname.split("/").filter(Boolean)
    )
  }
  if (!routeMatch) {
    throw new Error(`No route defined (path: ${url.pathname}).`)
  }

  const layoutEntries = matchLayouts(options.layouts, routeMatch.routeSegments)
  fileRouterInstance.current = new FileRouterController()
  fileRouterRoute.current = routeMatch.route
  const [page, ...layouts] = await Promise.all([
    routeMatch.pageEntry.load() as Promise<PageModule>,
    ...layoutEntries.map((e) => e.load()),
  ])
  fileRouterRoute.current = null

  // Check if page has static props pre-loaded at build time
  if (page.__KIRU_STATIC_PROPS__) {
    const staticProps = page.__KIRU_STATIC_PROPS__[window.location.pathname]
    if (staticProps) {
      pageProps = staticProps.error
        ? {
            data: null,
            error: new FileRouterDataLoadError(staticProps.error),
            loading: false,
          }
        : { data: staticProps.data, error: null, loading: false }
    } else {
      pageProps = { loading: true, data: null, error: null }
    }
  } else if (typeof page.config?.loader?.load === "function") {
    pageProps = { loading: true, data: null, error: null }
  }

  return {
    pages: options.pages,
    layouts: options.layouts,
    page: page,
    pageProps: pageProps,
    pageLayouts: layouts,
    params: routeMatch.params,
    query: parseQuery(url.search),
    route: routeMatch.route,
  }
}
