import type { CustomRequestContext, RouteHeadMeta, RouteMatch } from "./types.js"
import type { HydratedI18nPayload } from "./i18nContext.js"

export interface RenderRequestContext {
  headers?: HeadersInit
  method?: string
  context?: CustomRequestContext
}

export const DEFAULT_SSR_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
}

export type PreparedApp = {
  app: JSX.Element
  routeMatch: RouteMatch | null
  requestContext: CustomRequestContext
  serializedPageData?: unknown
  streamHeadMeta?: RouteHeadMeta
  pagePropsPromise?: Promise<Record<string, unknown>>
  earlyFlushHead?: boolean
  i18nPayload?: HydratedI18nPayload
  responseStatus: number
  responseHeaders: Record<string, string>
}

export type PrepareRedirect = {
  kind: "redirect"
  location: string
  headers?: Record<string, string>
}

export type PrepareError = {
  kind: "error"
  status: number
  body?: string
  headers?: Record<string, string>
}

export type PrepareAppResult =
  | PreparedApp
  | PrepareRedirect
  | PrepareError
  | null

export function isPrepareRedirect(
  p: Exclude<PrepareAppResult, null>
): p is PrepareRedirect {
  return "kind" in p && p.kind === "redirect"
}

export function isPrepareError(
  p: Exclude<PrepareAppResult, null>
): p is PrepareError {
  return "kind" in p && p.kind === "error"
}

export const MAX_SSR_MIDDLEWARE_REDIRECTS = 16
