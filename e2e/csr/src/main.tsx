import { createRouterApp } from "kiru/router/csr"
import { createContextAppOptions } from "./context/createContextAppOptions.tsx"
import i18n from "./i18n.js"
import { routes } from "./routes"
import "./style.css"

void createRouterApp(
  createContextAppOptions({
    routes,
    i18n,
    container: document.getElementById("app")!,
  })
)
