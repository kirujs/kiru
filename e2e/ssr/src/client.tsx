import { bootstrapSsrClient } from "kiru/ssr/router"
import { routes } from "./routes"
import "./style.css"

declare global {
  interface Window {
    /** Set by the SSR e2e bootstrap once `bootstrapSsrClient` resolves; used by Cypress streaming tests to assert hydration timing. */
    __kiruHydratedAt?: number
    /** Snapshot of a streaming/loader fallback presence the moment hydration completes — `cy.visit` blocks on `load`, so it's the only honest way to assert "fallback was visible while we hydrated". */
    __kiruFallbackVisibleAtHydration?: boolean
  }
}

void bootstrapSsrClient({
  routes,
  container: document.getElementById("app")!,
}).then(() => {
  window.__kiruHydratedAt = performance.now()
  window.__kiruFallbackVisibleAtHydration = !!document.querySelector(
    '[data-testid="streaming-fallback"], [data-testid="loader-fallback"]'
  )
})

