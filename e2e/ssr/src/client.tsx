import { createRouterApp } from "kiru/router/ssr"
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

void createRouterApp({
  routes,
  i18n,
  container,
}).then(() => {
  markRouterHydrated(container)
  window.__kiruFallbackVisibleAtHydration = !!document.querySelector(
    '[data-testid="streaming-fallback"], [data-testid="loader-fallback"]'
  )
})
