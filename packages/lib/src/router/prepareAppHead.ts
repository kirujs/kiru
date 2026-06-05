import {
  readPageHeadExport,
  createDynamicHeadContext,
  resolveMergedRoutePageHead,
} from "./pageHead.js"
import { buildLoaderContext } from "./runPageLoad.js"
import type { KiruLoader, PageProps } from "./loaders.js"
import type { RouteHeadMeta, RouteMatch } from "./types.js"
import { DEFAULT_SSR_HEADERS } from "./prepareAppTypes.js"

export async function resolveStreamHeadMeta(
  match: RouteMatch,
  pageMod: unknown,
  loaderCtx: ReturnType<typeof buildLoaderContext>,
  pageProps?: PageProps<KiruLoader<unknown>>
): Promise<RouteHeadMeta> {
  const pageHead = readPageHeadExport(pageMod)
  const headCtx = createDynamicHeadContext(loaderCtx, pageMod, pageProps)
  return resolveMergedRoutePageHead(match.route.head, pageHead, headCtx)
}

export function localeDetectionRedirectRenderHit(
  location: string,
  extraHeaders: Record<string, string>,
  stream: boolean
) {
  const redirectHeaders = {
    ...DEFAULT_SSR_HEADERS,
    location,
    ...extraHeaders,
  }
  if (stream) {
    return {
      kind: "stream" as const,
      result: {
        status: 302,
        headers: redirectHeaders,
        body: new ReadableStream<string>({
          start(controller) {
            controller.close()
          },
        }),
      },
    }
  }
  return {
    kind: "string" as const,
    result: {
      status: 302,
      headers: redirectHeaders,
      body: "",
    },
  }
}
