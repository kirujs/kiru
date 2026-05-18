import { bootstrapSsgClient } from "kiru/ssr/router"
import i18n from "./i18n.js"
import { routes } from "./routes"
import "./style.css"

void bootstrapSsgClient({
  routes,
  i18n,
  container: document.getElementById("app")!,
})
