import { createRouterApp } from "kiru/router/ssr"
import i18n from "./i18n.js"
import { routes } from "./routes"
import "./style.css"

declare global {
  interface Window {
    /** Set by the SSR e2e bootstrap once hydration resolves; used by Cypress streaming tests to assert hydration timing. */
    __kiruHydratedAt?: number
    /** Snapshot of a streaming/loader fallback presence the moment hydration completes — `cy.visit` blocks on `load`, so it's the only honest way to assert "fallback was visible while we hydrated". */
    __kiruFallbackVisibleAtHydration?: boolean
    /** Hydration cursor trace entries from lib/hydration (dev only). */
    __kiruHydrationTrace?: unknown[]
    /** Hydration mismatch/error messages captured during client bootstrap. */
    __kiruHydrationErrors?: string[]
  }
}

window.__kiruHydrationTrace = []
window.__kiruHydrationErrors = []
window.addEventListener("error", (event) => {
  window.__kiruHydrationErrors?.push(String(event.error ?? event.message))
})
window.addEventListener("unhandledrejection", (event) => {
  window.__kiruHydrationErrors?.push(String(event.reason))
})

createRouterApp({
  routes,
  i18n,
  container: document.getElementById("app")!,
}).then(
  () => {
    window.__kiruHydratedAt = performance.now()
    window.__kiruFallbackVisibleAtHydration = !!document.querySelector(
      '[data-testid="streaming-fallback"], [data-testid="loader-fallback"]'
    )
  }
)
