import { createRouterApp } from "kiru/router/ssg"
import i18n from "./i18n.js"
import { routes } from "./routes"
import "./style.css"

void createRouterApp({
  routes,
  i18n,
  container: document.getElementById("app")!,
})
