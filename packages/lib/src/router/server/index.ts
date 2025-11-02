import { createElement } from "../../element.js"
import { renderToReadableStream } from "../../ssr/server.js"
import {
  matchLayouts,
  matchRoute,
  parseQuery,
  wrapWithLayouts,
} from "../utils/index.js"
import { RouterContext } from "../context.js"
import type { PageConfig, PageProps, RouterState } from "../types.js"
import type { Readable } from "node:stream"
import { FormattedViteImportMap, PageModule } from "../types.internal.js"
import { __DEV__ } from "../../env.js"
import { FileRouterDataLoadError } from "../errors.js"

export interface RenderContext {
  pages: FormattedViteImportMap
  layouts: FormattedViteImportMap
  Document: Kiru.FC
  registerModule: (moduleId: string) => void
  registerPreloadedPageProps: (props: Record<string, unknown>) => void
}

export interface RenderResult {
  status: number
  immediate: string
  stream: Readable | null
}

export async function render(
  url: string,
  ctx: RenderContext,
  result?: RenderResult
): Promise<RenderResult> {
  const u = new URL(url, "http://localhost")
  const routeMatch = matchRoute(
    ctx.pages,
    u.pathname.split("/").filter(Boolean)
  )
  if (!routeMatch) {
    if (url === "/404" && result) {
      if (__DEV__) {
        console.warn(
          "[kiru/router]: No 404 route defined. Using fallback 404 page."
        )
      }
      return {
        status: 404,
        immediate:
          "<!doctype html><html><head><title>Not Found</title></head><body><h1>404</h1></body></html>",
        stream: null,
      }
    }
    return render("/404", ctx, {
      ...(result ?? {}),
      immediate: "",
      stream: null,
      status: 404,
    })
  }

  const { pageEntry, routeSegments, params } = routeMatch
  const layoutEntries = matchLayouts(ctx.layouts, routeSegments)

  if (__DEV__) {
    ;[pageEntry, ...layoutEntries].forEach((e) => {
      ctx.registerModule(e.filePath!)
    })
  }

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
        path: u.pathname,
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

  const app = createElement(RouterContext.Provider, {
    children: createElement(ctx.Document, { children }),
    value: {
      state: {
        params,
        query,
        path: u.pathname,
        signal: abortController.signal, // Server-side signal (not abortable)
      } as RouterState,
    },
  })

  let { immediate, stream } = renderToReadableStream(app)
  const hasHeadOutlet = immediate.includes("<kiru-head-outlet>")
  const hasHeadContent = immediate.includes("<kiru-head-content>")

  if (hasHeadOutlet && hasHeadContent) {
    let [preHeadContent = "", headContentInner = "", postHeadContent = ""] =
      immediate.split(/<kiru-head-content>|<\/kiru-head-content>/)

    preHeadContent = preHeadContent.replace(
      "<kiru-head-outlet>",
      headContentInner
    )
    immediate = `${preHeadContent}${postHeadContent}`
  } else if (hasHeadContent) {
    // remove head content element and everything within it
    immediate = immediate.replace(
      /<kiru-head-content>(.*?)<\/kiru-head-content>/,
      ""
    )
  } else if (hasHeadOutlet) {
    // remove head outlet element and everything within it
    immediate = immediate.replaceAll("<kiru-head-outlet>", "")
  }

  // console.log("immediate", immediate)

  return {
    status: 200,
    immediate: "<!doctype html>" + immediate,
    stream,
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
