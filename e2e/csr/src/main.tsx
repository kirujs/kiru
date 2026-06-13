import { createRouterApp } from "kiru/router/csr"
import { markRouterHydrated } from "../../shared/markRouterHydrated.js"
import { installCsrRouterDiagnostics } from "./e2e/csrRouterDiagnostics.js"
import i18n from "./i18n.js"
import { routes } from "./routes"
import "./style.css"

declare global {
  interface Window {
    __kiruOutletDebug?: boolean
    __kiruOutletDebugLog?: Array<{
      ts: number
      event: string
      data?: Record<string, unknown>
    }>
  }
}

installCsrRouterDiagnostics()
try {
  if (localStorage.getItem("kiru-outlet-debug") === "1") {
    window.__kiruOutletDebug = true
  }
} catch {
  // ignore
}
window.__kiruOutletDebug = true

const container = document.getElementById("app")!

void createRouterApp({
  routes,
  i18n,
  container,
}).then(() => {
  markRouterHydrated(container)
})
