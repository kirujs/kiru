import type { Router } from "./routerInstance.js"
import { getRouterInstanceRuntime } from "./routerRuntime.js"

export const ROUTE_ANNOUNCER_TAG = "kiru-route-announcer"
export const ROUTE_ANNOUNCER_LIVE_REGION_ID = "__kiru-route-announcer__"

const HOST_STYLE = "position:absolute;"
const LIVE_REGION_STYLE =
  "position:absolute;border:0;height:1px;margin:-1px;padding:0;width:1px;clip:rect(0,0,0,0);overflow:hidden;white-space:nowrap;overflow-wrap:normal;"

let lastAnnouncedKey = ""

function createRouteAnnouncerHost(): HTMLElement {
  const host = document.createElement(ROUTE_ANNOUNCER_TAG)
  host.style.cssText = HOST_STYLE
  const shadow = host.attachShadow({ mode: "open" })
  const region = document.createElement("div")
  region.id = ROUTE_ANNOUNCER_LIVE_REGION_ID
  region.setAttribute("role", "alert")
  region.setAttribute("aria-live", "assertive")
  region.setAttribute("data-testid", "kiru-route-announcer")
  region.style.cssText = LIVE_REGION_STYLE
  shadow.appendChild(region)
  return host
}

/**
 * Append `<kiru-route-announcer>` to `document.body` (client only).
 * Called from {@link createRouter} when `navigationAnnouncer` is enabled.
 */
export function ensureRouteAnnouncerInDocument(enabled: boolean): void {
  if (typeof document === "undefined" || !enabled) return
  if (document.querySelector(ROUTE_ANNOUNCER_TAG)) return
  document.body.appendChild(createRouteAnnouncerHost())
}

function getLiveRegionElement(): HTMLElement | null {
  if (typeof document === "undefined") return null
  const host = document.querySelector(ROUTE_ANNOUNCER_TAG)
  return host?.shadowRoot?.getElementById(ROUTE_ANNOUNCER_LIVE_REGION_ID) ?? null
}

/** Announce `document.title` after a successful client navigation (not initial load). */
export function announceNavigationIfReady(router: Router): void {
  if (!router.navigationAnnouncer) return
  if (typeof document === "undefined") return
  const last = getRouterInstanceRuntime(router).getLastNavigation()
  if (!last || last.failure) return
  if (!last.from) return
  const region = getLiveRegionElement()
  if (!region) return
  const title = document.title
  const routeKey = `${router.pathname.peek()}:${title}`
  if (routeKey === lastAnnouncedKey) return
  lastAnnouncedKey = routeKey
  region.textContent = title
}

/** @internal Test helper */
export function resetNavigationAnnouncerStateForTests(): void {
  lastAnnouncedKey = ""
  if (typeof document === "undefined") return
  document.querySelector(ROUTE_ANNOUNCER_TAG)?.remove()
}
