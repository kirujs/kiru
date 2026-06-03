import { createRouterApp } from "kiru/router/csr"
import { routes } from "./routes"

void createRouterApp({
  routes,
  pathPolicy: { baseUrl: "/app", trailingSlash: "never" },
  container: document.getElementById("app")!,
}).then(() => {
  ;(window as Window & { __kiruHydratedAt?: number }).__kiruHydratedAt =
    performance.now()
})
