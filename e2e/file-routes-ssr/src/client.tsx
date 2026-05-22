import { createRouterApp } from "kiru/router/ssr"
import { routes } from "./routes"

void createRouterApp({
  routes,
  container: document.getElementById("app")!,
}).then(() => {
  window.__kiruHydratedAt = performance.now()
})

declare global {
  interface Window {
    __kiruHydratedAt?: number
  }
}
