import { createRouterApp } from "kiru/router/ssr"
import { routes } from "./routes"

createRouterApp({
  routes,
  container: document.getElementById("app")!,
})
