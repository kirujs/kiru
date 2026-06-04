import { createRouterApp } from "kiru/router/ssg"
import { markRouterHydrated } from "../../shared/markRouterHydrated.js"
import i18n from "./i18n.js"
import { routes } from "./routes"
import "./style.css"

const container = document.getElementById("app")!

void createRouterApp({
  routes,
  i18n,
  container,
}).then(() => {
  markRouterHydrated(container)
})
