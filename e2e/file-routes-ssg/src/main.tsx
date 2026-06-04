import { createRouterApp } from "kiru/router/ssg"
import { markRouterHydrated } from "../../shared/markRouterHydrated.js"
import { routes } from "./routes"

const container = document.getElementById("app")!

void createRouterApp({
  routes,
  container,
}).then(() => {
  markRouterHydrated(container)
})
