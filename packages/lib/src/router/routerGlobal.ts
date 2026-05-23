import { requestToken } from "../globals.js"
import {
  KIRU_INVALIDATE_RESPONSE_HEADER,
  KIRU_TOKEN_RESPONSE_HEADER,
} from "../remote/actionHeaders.js"
import type { Router } from "./csr.js"

const ROUTER_GLOBAL_KEY = "__kiru_router"

/** Register the active client router (SSR bootstrap / CSR app). */
export function registerKiruRouter(router: Router): void {
  if (typeof globalThis === "undefined") return
  ;(globalThis as Record<string, unknown>)[ROUTER_GLOBAL_KEY] = router
}

export function getKiruRouter(): Router | undefined {
  if (typeof globalThis === "undefined") return undefined
  return (globalThis as Record<string, unknown>)[ROUTER_GLOBAL_KEY] as
    | Router
    | undefined
}

/** Parse `x-kiru-invalidate` from an action response and call `router.invalidate`. */
export function applyInvalidateResponseHeader(header: string | null): void {
  if (!header) return
  const routeIds = header
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (!routeIds.length) return
  void getKiruRouter()?.invalidate({ routeIds })
}

/** Apply framework action response headers (invalidate routes, refreshed context token). */
export function applyActionResponseHeaders(headers: Headers): void {
  applyInvalidateResponseHeader(
    headers.get(KIRU_INVALIDATE_RESPONSE_HEADER)
  )
  const token = headers.get(KIRU_TOKEN_RESPONSE_HEADER)
  if (token) {
    requestToken.setCurrent(token)
  }
}
