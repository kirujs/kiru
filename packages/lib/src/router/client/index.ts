import { createElement } from "../../element.js"
import { hydrate } from "../../ssr/client.js"
import { FileRouter } from "../fileRouter.js"
import {
  matchModules,
  matchRoute,
  match404Route,
  parseQuery,
  runBeforeEachGuards,
  runAfterEachGuards,
} from "../utils/index.js"
import type {
  FormattedViteImportMap,
  GuardModule,
  PageModule,
} from "../types.internal"
import type { FileRouterConfig, FileRouterPreloadConfig } from "../types"
import {
  fileRouterInstance,
  fileRouterRoute,
  requestContext,
  routerCache,
} from "../globals.js"
import { FileRouterController } from "../fileRouterController.js"
import { FileRouterDataLoadError } from "../errors.js"
import { __DEV__ } from "../../env.js"
import { RouterCache } from "../cache.js"
import { RequestContext } from "../context.js"

interface InitClientOptions {
  dir: string
  baseUrl: string
  pages: FormattedViteImportMap<PageModule>
  layouts: FormattedViteImportMap
  guards?: FormattedViteImportMap<GuardModule>
  transition: boolean
  hydrationMode?: Kiru.HydrationMode
}

export async function initClient(options: InitClientOptions) {
  routerCache.current = new RouterCache()
  const {
    dir,
    baseUrl,
    pages,
    layouts,
    guards,
    transition,
    hydrationMode = "static",
  } = options

  try {
    requestContext.current = JSON.parse(
      document.querySelector("[k-request-context]")!.innerHTML
    )
  } catch {}

  const preloaded = await preparePreloadConfig(
    options,
    false,
    hydrationMode === "dynamic"
  )
  const config: FileRouterConfig = {
    dir,
    baseUrl,
    pages,
    layouts,
    guards,
    transition,
    preloaded,
  }

  const children = createElement(FileRouter, { config })
  const app =
    hydrationMode === "static"
      ? children
      : createElement(RequestContext.Provider, {
          value: requestContext.current,
          children,
        })

  hydrate(app, document.body, { hydrationMode })

  if (__DEV__) {
    onLoadedDev()
  }
}

async function preparePreloadConfig(
  options: InitClientOptions,
  isStatic404 = false,
  _isSSR = false
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

  const layoutEntries = matchModules(options.layouts, routeMatch.routeSegments)

  // Load and run guards before loading page
  // if SSR, do we even need to do this?
  let guardModules: GuardModule[] = []
  if (options.guards) {
    const guardEntries = matchModules(options.guards, routeMatch.routeSegments)
    guardModules = await Promise.all(guardEntries.map((entry) => entry.load()))

    const redirectPath = await runBeforeEachGuards(guardModules, url.pathname, {
      ...requestContext.current,
    })
    if (redirectPath !== null) {
      window.location.href = redirectPath
    }
  }

  fileRouterInstance.current = new FileRouterController()
  fileRouterRoute.current = routeMatch.route
  const [page, ...layouts] = await Promise.all([
    routeMatch.pageEntry.load() as Promise<PageModule>,
    ...layoutEntries.map((e) => e.load()),
  ])
  fileRouterRoute.current = null

  const query = parseQuery(window.location.search)

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
        query,
      }

      cacheData = routerCache.current!.get(cacheKey, loader.cache)
    }
  }

  window.__kiru.on("mount", () => {
    runAfterEachGuards(guardModules, url.pathname, "")
  })

  return {
    pages: options.pages,
    layouts: options.layouts,
    guards: options.guards,
    page: page,
    pageProps: pageProps,
    pageLayouts: layouts,
    params: routeMatch.params,
    query: query,
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
