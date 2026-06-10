import { createRouterApp } from "kiru/router/ssr"
import { markRouterHydrated } from "../../shared/markRouterHydrated.js"
import { installE2eRouterDiagnostics } from "./e2e/routerDiagnostics.js"
import i18n from "./i18n.js"
import { routes } from "./routes"
import "./style.css"

declare global {
  interface Window {
    /** Snapshot of a streaming/loader fallback presence the moment hydration completes — `cy.visit` blocks on `load`, so it's the only honest way to assert "fallback was visible while we hydrated". */
    __kiruFallbackVisibleAtHydration?: boolean
    __kiruOutletDebug?: boolean
    __kiruOutletDebugLog?: Array<{
      ts: number
      event: string
      data?: Record<string, unknown>
    }>
  }
}

installE2eRouterDiagnostics()
try {
  if (localStorage.getItem("kiru-outlet-debug") === "1") {
    window.__kiruOutletDebug = true
  }
} catch {
  // ignore
}

const container = document.getElementById("app")!

void createRouterApp({
  routes,
  i18n,
  container,
})
  .then(() => {
    markRouterHydrated(container)
    window.__kiruFallbackVisibleAtHydration = !!document.querySelector(
      '[data-testid="streaming-fallback"], [data-testid="loader-fallback"], [data-testid="feed-fallback"], [data-testid="communities-fallback"]'
    )
  })
  .catch((err: unknown) => {
    throw err
  })
