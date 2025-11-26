import path from "path"
import { createElement, Fragment } from "../../element.js"
import { __DEV__ } from "../../env.js"
import { renderToString } from "../../renderToString.js"
import { renderToReadableStream } from "../../ssr/server.js"
import {
  matchModules,
  matchRoute,
  match404Route,
  parseQuery,
  wrapWithLayouts,
  runBeforeEachGuards,
  runAfterEachGuards,
  runBeforeEnterHooks,
} from "../utils/index.js"
import { RouterContext, RequestContext } from "../context.js"
import type { PageConfig, PageProps, RouterState } from "../types.js"
import type {
  FormattedViteImportMap,
  GuardModule,
  PageModule,
} from "../types.internal.js"

export interface SSRRenderContext {
  pages: FormattedViteImportMap<PageModule>
  layouts: FormattedViteImportMap
  guards: FormattedViteImportMap<GuardModule>
  Document: Kiru.FC
  userContext: Kiru.RequestContext
  registerModule: (moduleId: string) => void
}

export interface SSRHttpResponse {
  html: string
  statusCode: number
  headers: Array<[string, string]>
  stream: ReadableStream | null
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
            stream: null,
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
          stream: null,
        },
      }
    }
  }
  const { pageEntry, routeSegments, params } = routeMatch
  const is404Route = routeMatch.routeSegments.includes("404")

  const guardEntries = matchModules(ctx.guards, routeSegments)
  const guardModules = await Promise.all(
    guardEntries.map((entry) => entry.load() as unknown as Promise<GuardModule>)
  )

  const redirectPath = await runBeforeEachGuards(
    guardModules,
    { ...ctx.userContext },
    u.pathname
  )

  if (redirectPath !== null) {
    return createRedirectResult(redirectPath)
  }

  const layoutEntries = matchModules(ctx.layouts, routeSegments)

  // Register all modules for CSS collection
  ;[pageEntry, ...layoutEntries].forEach((e) => {
    ctx.registerModule(e.filePath)
  })

  const [page, ...layouts] = await Promise.all([
    pageEntry.load(),
    ...layoutEntries.map((layoutEntry) => layoutEntry.load()),
  ])

  const onBeforeEnter = page.config?.hooks?.onBeforeEnter
  if (onBeforeEnter) {
    const asArray = Array.isArray(onBeforeEnter)
      ? onBeforeEnter
      : [onBeforeEnter]
    const redirectPath = await runBeforeEnterHooks(
      asArray,
      { ...ctx.userContext },
      u.pathname
    )
    if (redirectPath) {
      return createRedirectResult(redirectPath)
    }
  }

  const query = parseQuery(u.search)

  let props = {} as PageProps<PageConfig>
  const config = page.config ?? {}
  const abortController = new AbortController()

  // PageConfig loaders don't run on the server
  if (config.loader) {
    props = {
      data: null,
      error: null,
      loading: true,
    }
  }

  let documentShell = renderToString(createElement(ctx.Document))

  if (
    documentShell.includes("</body>") ||
    !documentShell.includes("<kiru-body-outlet>")
  ) {
    throw new Error(
      "[kiru/router]: Document is expected to contain a <Body.Outlet> element. See https://kirujs.dev/docs/api/file-router#general-usage"
    )
  }

  const children = wrapWithLayouts(
    layouts
      .map((layout) => layout.default)
      .filter((l) => typeof l === "function"),
    page.default,
    props
  )

  const routerContextValue = {
    state: {
      params,
      query,
      pathname: u.pathname,
      hash: "",
      signal: abortController.signal,
    } satisfies RouterState,
  }

  const app = createElement(RouterContext.Provider, {
    children: createElement(RequestContext.Provider, {
      children: Fragment({ children }),
      value: ctx.userContext,
    }),
    value: routerContextValue,
  })

  let { immediate: pageOutletContent, stream } = renderToReadableStream(app)
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

  const html = `<!DOCTYPE html>${prePageOutlet}<body>${pageOutletContent}</body>${postPageOutlet}`
  const statusCode = is404Route ? 404 : 200

  queueMicrotask(() => {
    runAfterEachGuards(guardModules, { ...ctx.userContext }, u.pathname)
  })

  return {
    httpResponse: {
      html,
      statusCode,
      headers: [["Content-Type", "text/html;charset=utf-8"]],
      stream,
    },
  }
}

function createRedirectResult(to: string): SSRRenderResult {
  return {
    httpResponse: {
      statusCode: 302,
      headers: [["Location", to]],
      html: "",
      stream: null,
    },
  }
}
