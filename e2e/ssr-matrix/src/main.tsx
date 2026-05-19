import { createRouterApp } from "kiru/router/ssr"
import { routes } from "./fixture/routes"

createRouterApp({
  routes,
  container: document.getElementById("app")!,
})
