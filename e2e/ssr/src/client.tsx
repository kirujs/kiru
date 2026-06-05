import { createRouterApp } from "kiru/router/ssr"
import {
  finalizeBootstrapDiagnostics,
  installBootstrapDiagnostics,
  traceBootstrapEvent,
} from "../../shared/bootstrapDiagnostics.js"
import { markRouterHydrated } from "../../shared/markRouterHydrated.js"
import i18n from "./i18n.js"
import { routes } from "./routes"
import "./style.css"

declare global {
  interface Window {
    /** Snapshot of a streaming/loader fallback presence the moment hydration completes — `cy.visit` blocks on `load`, so it's the only honest way to assert "fallback was visible while we hydrated". */
    __kiruFallbackVisibleAtHydration?: boolean
  }
}

const container = document.getElementById("app")!

installBootstrapDiagnostics(container)
traceBootstrapEvent("bootstrap:start")

void createRouterApp({
  routes,
  i18n,
  container,
})
  .then(() => {
    finalizeBootstrapDiagnostics(container)
    markRouterHydrated(container)
    traceBootstrapEvent("bootstrap:resolved")
    window.__kiruFallbackVisibleAtHydration = !!document.querySelector(
      '[data-testid="streaming-fallback"], [data-testid="loader-fallback"], [data-testid="feed-fallback"], [data-testid="communities-fallback"]'
    )
  })
  .catch((err: unknown) => {
    traceBootstrapEvent("bootstrap:reject", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    finalizeBootstrapDiagnostics(container)
    throw err
  })
