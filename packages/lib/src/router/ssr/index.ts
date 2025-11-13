import path from "path"
import { type Readable } from "stream"
import { createElement, Fragment } from "../../element.js"

import {
  matchLayouts,
  matchRoute,
  match404Route,
  parseQuery,
  wrapWithLayouts,
} from "../utils/index.js"
import { RouterContext } from "../context.js"
import type { PageConfig, PageProps, RouterState } from "../types.js"
import { FormattedViteImportMap, PageModule } from "../types.internal.js"
import { __DEV__ } from "../../env.js"
import { FileRouterDataLoadError } from "../errors.js"
import { renderToString } from "../../renderToString.js"

export interface SSRRenderContext {
  pages: FormattedViteImportMap
  layouts: FormattedViteImportMap
  Document: Kiru.FC
  registerModule: (moduleId: string) => void
}

export interface SSRHttpResponse {
  html: string
  statusCode: number
  headers: Array<[string, string]>
  stream?: Readable
}

export interface SSRRenderResult {
  httpResponse: SSRHttpResponse | null
}

export async function render(
  url: string,
  ctx: SSRRenderContext
): Promise<SSRRenderResult> {
  const extName = path.extname(url)
  if (extName && extName.length > 0) {
    return {
      httpResponse: null,
    }
  } else if (url.startsWith("/@")) {
    return {
      httpResponse: null,
    }
  }
  const u = new URL(url, "http://localhost")
  const pathSegments = u.pathname.split("/").filter(Boolean)
  let routeMatch = matchRoute(ctx.pages, pathSegments)

  if (!routeMatch) {
    // Try to find a 404 page in parent directories
    const fourOhFourMatch = match404Route(ctx.pages, pathSegments)
    if (fourOhFourMatch) {
      routeMatch = fourOhFourMatch
    } else {
      // Fallback to root 404 or default fallback
      if (url === "/404") {
        if (__DEV__) {
          console.warn(
            "[kiru/router]: No 404 route defined. Using fallback 404 page."
          )
        }
        return {
          httpResponse: {
            statusCode: 404,
            headers: [["Content-Type", "text/html"]],
            html: "<!doctype html><html><head><title>Not Found</title></head><body><h1>404</h1></body></html>",
          },
        }
      }
      // Recursively render the 404 page
      const notFoundResponse = await render("/404", ctx)
      return {
        httpResponse: {
          html: notFoundResponse.httpResponse?.html ?? "",
          headers: notFoundResponse.httpResponse?.headers ?? [
            ["Content-Type", "text/html"],
          ],
          ...notFoundResponse,
          statusCode: 404,
        },
      }
    }
  }

  const { pageEntry, routeSegments, params } = routeMatch
  const is404Route = routeMatch.routeSegments.includes("404")
  const layoutEntries = matchLayouts(ctx.layouts, routeSegments)

  // Register all modules for CSS collection
  ;[pageEntry, ...layoutEntries].forEach((e) => {
    ctx.registerModule(e.filePath)
  })

  const [page, ...layouts] = await Promise.all([
    pageEntry.load() as unknown as Promise<PageModule>,
    ...layoutEntries.map((layoutEntry) => layoutEntry.load()),
  ])

  const query = parseQuery(u.search)

  let props = {} as PageProps<PageConfig>
  const config = page.config ?? {}
  const abortController = new AbortController()

  // Handle data loading for SSR
  if (config.loader) {
    // In SSR, we always load data at request time (even for "static" mode)
    const routerState: RouterState = {
      pathname: u.pathname,
      hash: "",
      params,
      query,
      signal: abortController.signal,
    }
    const timeout = setTimeout(() => {
      abortController.abort(
        "[kiru/router]: Page data loading timed out after 10 seconds"
      )
    }, 10000)

    try {
      const data = await config.loader.load(routerState)
      props = {
        data,
        error: null,
        loading: false,
      }
    } catch (error) {
      props = {
        error: new FileRouterDataLoadError(error),
        loading: false,
        data: null,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  const children = wrapWithLayouts(
    layouts
      .map((layout) => layout.default)
      .filter((l) => typeof l === "function"),
    page.default,
    props
  )

  let documentShell = renderToString(createElement(ctx.Document))

  if (
    documentShell.includes("</body>") ||
    !documentShell.includes("<kiru-body-outlet>")
  ) {
    throw new Error(
      "[kiru/router]: Document is expected to contain a <Body.Outlet> element. See https://kirujs.dev/docs/api/file-router#general-usage"
    )
  }

  const app = createElement(RouterContext.Provider, {
    children: Fragment({ children }),
    value: {
      state: {
        params,
        query,
        pathname: u.pathname,
        signal: abortController.signal,
      } as RouterState,
    },
  })

  let pageOutletContent = renderToString(app)
  const hasHeadContent = pageOutletContent.includes("<kiru-head-content>")
  const hasHeadOutlet = documentShell.includes("<kiru-head-outlet>")

  if (hasHeadOutlet && hasHeadContent) {
    let [preHeadContent = "", headContentInner = "", postHeadContent = ""] =
      pageOutletContent.split(/<kiru-head-content>|<\/kiru-head-content>/)

    documentShell = documentShell.replace(
      "<kiru-head-outlet>",
      headContentInner
    )
    pageOutletContent = `${preHeadContent}${postHeadContent}`
  } else if (hasHeadContent) {
    // remove head content element and everything within it
    pageOutletContent = pageOutletContent.replace(
      /<kiru-head-content>(.*?)<\/kiru-head-content>/,
      ""
    )
  } else if (hasHeadOutlet) {
    // remove head outlet element and everything within it
    documentShell = documentShell.replaceAll("<kiru-head-outlet>", "")
  }

  const [prePageOutlet, postPageOutlet] =
    documentShell.split("<kiru-body-outlet>")

  const html = `<!doctype html>${prePageOutlet}<body>${pageOutletContent}</body>${postPageOutlet}`
  const statusCode = is404Route ? 404 : 200

  return {
    httpResponse: {
      html,
      statusCode,
      headers: [["Content-Type", "text/html"]],
      // stream property can be added in the future for streaming support
    },
  }
}
