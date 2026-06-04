import { requestToken } from "../globals.js"
import {
  KIRU_INVALIDATE_RESPONSE_HEADER,
  KIRU_TOKEN_RESPONSE_HEADER,
} from "../remote/actionHeaders.js"
import type { Router } from "./routerInstance.js"

const ROUTER_GLOBAL_KEY = "__kiru_router"

let activeRouter: Router | undefined

/** Returns the client router claimed by the active {@link RouterProvider}. */
export function getActiveRouter(): Router | undefined {
  return activeRouter
}

/**
 * Claim the single client router slot for this page.
 * Called from {@link RouterProvider} when the app shell mounts.
 */
export function claimActiveRouter(router: Router): void {
  if (activeRouter && activeRouter !== router) {
    throw new Error(
      "[kiru] Only one RouterProvider is supported per page (a second router was mounted)"
    )
  }
  activeRouter = router
  if (typeof globalThis !== "undefined") {
    ;(globalThis as Record<string, unknown>)[ROUTER_GLOBAL_KEY] = router
  }
}

/** Release the active router slot when the app unmounts or {@link Router.dispose} runs. */
export function releaseActiveRouter(router: Router): void {
  if (activeRouter !== router) return
  activeRouter = undefined
  if (typeof globalThis !== "undefined") {
    delete (globalThis as Record<string, unknown>)[ROUTER_GLOBAL_KEY]
  }
}

/** Parse `x-kiru-invalidate` from an action response and call `router.invalidate`. */
export function applyInvalidateResponseHeader(header: string | null): void {
  if (!header) return
  const routeIds = header
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (!routeIds.length) return
  void getActiveRouter()?.invalidate({ routeIds })
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
