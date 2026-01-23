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

export interface RenderContext {
  baseUrl: string
  pages: FormattedViteImportMap
  layouts: FormattedViteImportMap
  Document: Kiru.FC
  registerModule: (moduleId: string) => void
  registerPreloadedPageProps: (props: Record<string, unknown>) => void
}

export interface RenderResult {
  status: number
  body: string
}

export async function render(
  url: string,
  ctx: RenderContext,
  result?: RenderResult
): Promise<RenderResult> {
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
      if (url === "/404" && result) {
        if (__DEV__) {
          console.warn(
            "[kiru/router]: No 404 route defined. Using fallback 404 page."
          )
        }
        return {
          status: 404,
          body: "<!doctype html><html><head><title>Not Found</title></head><body><h1>404</h1></body></html>",
        }
      }
      return render("/404", ctx, {
        ...(result ?? {}),
        body: "",
        status: 404,
      })
    }
  }

  const { pageEntry, routeSegments, params } = routeMatch
  const is404Route = routeMatch.routeSegments.includes("404")
  const layoutEntries = matchLayouts(ctx.layouts, routeSegments)

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

  if (config.loader) {
    if (config.loader.mode !== "static" || __DEV__) {
      props = { loading: true, data: null, error: null }
    } else {
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
        ctx.registerPreloadedPageProps({ data: props.data, error: props.error })
      }
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
      baseUrl: ctx.baseUrl.slice(0, -1),
      state: {
        params,
        query,
        pathname: u.pathname,
        signal: abortController.signal, // Server-side signal (not abortable)
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

  // console.log("immediate", immediate)

  return {
    status: is404Route ? 404 : (result?.status ?? 200),
    body: `<!doctype html>${prePageOutlet}<body>${pageOutletContent}</body>${postPageOutlet}`,
  }
}

export async function generateStaticPaths(pages: FormattedViteImportMap) {
  const results: Record<string, string> = {}
  const entries = Object.values(pages)
  for (const entry of entries) {
    // Build a clean URL path excluding group segments like (articles)
    const urlSegments = entry.segments.filter(
      (s) => !(s.startsWith("(") && s.endsWith(")"))
    )

    const basePath = "/" + urlSegments.join("/")
    // if (basePath.endsWith("/404")) continue

    const hasDynamic = urlSegments.some((s) => s.startsWith(":"))
    if (!hasDynamic) {
      results[basePath === "" ? "/" : basePath] = entry.filePath
      continue
    }
    try {
      const mod: PageModule = await entry.load()
      const gen = mod?.config?.generateStaticParams
      if (!gen) continue
      const paramsList = await gen()
      if (!Array.isArray(paramsList)) continue

      for (const params of paramsList) {
        let p = basePath
        for (const key in params) {
          const value = params[key]
          p = p.replace(`:${key}*`, value).replace(`:${key}`, value)
        }
        results[p] = entry.filePath
      }
    } catch {}
  }
  return results
}
