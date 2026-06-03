import { createRouterApp } from "kiru/router/ssg"
import { routes } from "./routes"

void createRouterApp({
  routes,
  container: document.getElementById("app")!,
}).then(() => {
  ;(window as Window & { __kiruHydratedAt?: number }).__kiruHydratedAt =
    performance.now()
})
