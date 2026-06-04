import { createRouterApp } from "kiru/router/ssr"
import { markRouterHydrated } from "../../shared/markRouterHydrated.js"
import { routes } from "./fixture/routes"

const container = document.getElementById("app")!

void createRouterApp({
  routes,
  container,
}).then(() => {
  markRouterHydrated(container)
})
