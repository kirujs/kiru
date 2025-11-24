// initClient({ dir, baseUrl, pages, layouts })

import { createElement, Fragment } from "../../element.js"
import { hydrate } from "../../ssr/client.js"
import { FileRouter } from "../fileRouter.js"
import {
  matchLayouts,
  matchRoute,
  match404Route,
  parseQuery,
} from "../utils/index.js"
import type { FormattedViteImportMap, PageModule } from "../types.internal"
import type { FileRouterConfig, FileRouterPreloadConfig } from "../types"
import { fileRouterInstance, fileRouterRoute, routerCache } from "../globals.js"
import { FileRouterController } from "../fileRouterController.js"
import { FileRouterDataLoadError } from "../errors.js"
import { __DEV__ } from "../../env.js"
import { RouterCache } from "../cache.js"

interface InitClientOptions {
  dir: string
  baseUrl: string
  pages: FormattedViteImportMap
  layouts: FormattedViteImportMap
  transition: boolean
  hydrationMode?: Kiru.HydrationMode
}

export async function initClient(options: InitClientOptions) {
  routerCache.current = new RouterCache()
  const { dir, baseUrl, pages, layouts, transition, hydrationMode } = options

  const config: FileRouterConfig = {
    dir,
    baseUrl,
    pages,
    layouts,
    transition,
    preloaded: await preparePreloadConfig(options),
  }

  const children = createElement(FileRouter, { config })
  /**
   * With SSR, we need to wrap the app in a fragment to mirror the
   * structure created on the server because it wraps the app
   * with RequestContext.Provider. Not needed on client because
   * we parse it from the document.
   */
  const app = hydrationMode === "dynamic" ? Fragment({ children }) : children

  hydrate(app, document.body, {
    hydrationMode: hydrationMode ?? "static",
  })

  if (__DEV__) {
    onLoadedDev()
  }
}

async function preparePreloadConfig(
  options: InitClientOptions,
  isStatic404 = false
): Promise<FileRouterPreloadConfig> {
  let pageProps = {}
  let cacheData: null | { value: unknown } = null
  let url = new URL(window.location.pathname, "http://localhost")
  const pathSegments = url.pathname.split("/").filter(Boolean)
  let routeMatch = matchRoute(options.pages, pathSegments)

  if (routeMatch === null || isStatic404) {
    // Try to find a 404 page in parent directories
    const _404Match = match404Route(options.pages, pathSegments)
    if (!_404Match) {
      throw new Error(`No 404 route defined (path: ${url.pathname}).`)
    }
    routeMatch = _404Match
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
    if (!staticProps) {
      return preparePreloadConfig(options, true)
    }

    pageProps = staticProps.error
      ? {
          data: null,
          error: new FileRouterDataLoadError(staticProps.error),
          loading: false,
        }
      : { data: staticProps.data, error: null, loading: false }
  } else if (typeof page.config?.loader?.load === "function") {
    pageProps = { loading: true, data: null, error: null }

    const loader = page.config.loader
    // Check cache first if caching is enabled
    if (loader.mode !== "static" && loader.cache) {
      const cacheKey = {
        path: window.location.pathname,
        params: routeMatch.params,
        query: parseQuery(url.search),
      }

      cacheData = routerCache.current!.get(cacheKey, loader.cache)
    }
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
    cacheData,
  }
}

function onLoadedDev() {
  if (!__DEV__) {
    throw new Error(
      "onLoadedDev should not have been included in production build."
    )
  }
  removeInjectedStyles()
}

function removeInjectedStyles() {
  let sleep = 2

  function runClean() {
    if (clean()) return

    if (sleep < 1000) {
      sleep *= 2
    }
    setTimeout(runClean, sleep)
  }

  setTimeout(runClean, sleep)
}

function clean() {
  let isCleaned = true
  const VITE_ID = "data-vite-dev-id"
  const injectedByVite = [
    ...document.querySelectorAll(`style[${VITE_ID}]`),
  ].map((style) => style.getAttribute(VITE_ID))

  const suffix = "?temp"
  const injectedByKiru = [
    ...document.querySelectorAll(
      `link[rel="stylesheet"][type="text/css"][href$="${suffix}"]`
    ),
  ]

  injectedByKiru.forEach((linkKiru) => {
    const href = linkKiru.getAttribute("href")!
    let filePathAbsoluteUserRootDir = href.slice(0, -suffix.length)
    const prefix = "/@fs/"
    if (filePathAbsoluteUserRootDir.startsWith(prefix))
      filePathAbsoluteUserRootDir = filePathAbsoluteUserRootDir.slice(
        prefix.length
      )

    if (
      injectedByVite.some((filePathAbsoluteFilesystem) =>
        filePathAbsoluteFilesystem!.endsWith(filePathAbsoluteUserRootDir)
      )
    ) {
      linkKiru.remove()
    } else {
      isCleaned = false
    }
  })
  return isCleaned
}
