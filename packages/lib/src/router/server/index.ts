import { createElement } from "../../element.js"
import { renderToReadableStream } from "../../ssr/server.js"
import {
  matchLayouts,
  matchRoute,
  parseQuery,
  wrapWithLayouts,
} from "../utils/index.js"
import { RouterContext } from "../context.js"
import type { RouterState } from "../types.js"
import type { Readable } from "node:stream"
import { FormattedViteImportMap } from "../types.internal.js"
import { __DEV__ } from "../../env.js"

export interface RenderContext {
  moduleIds: string[]
  pages: FormattedViteImportMap
  layouts: FormattedViteImportMap
  Document: Kiru.FC
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
      // todo: warn in development (no 404 route)
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
    ctx.moduleIds.push(
      routeMatch.pageEntry.filePath!,
      ...layoutEntries.map((e) => e.filePath!)
    )
  }

  const [page, ...layouts] = await Promise.all([
    pageEntry.load(),
    ...layoutEntries.map((layoutEntry) => layoutEntry.load()),
  ])

  const children = wrapWithLayouts(
    layouts
      .map((layout) => layout.default)
      .filter((l) => typeof l === "function"),
    page.default,
    {}
  )

  const query = parseQuery(u.search)
  const app = createElement(RouterContext.Provider, {
    children: createElement(ctx.Document, { children }),
    value: {
      // todo: address lack of AbortSignal
      state: { params, query, path: u.pathname } as RouterState,
    },
  })

  const { immediate, stream } = renderToReadableStream(app)
  return { status: 200, immediate: "<!doctype html>" + immediate, stream }
}
