import { createRouterApp } from "kiru/router/ssg"
import { createContextAppOptions } from "../../csr/src/context/createContextAppOptions.js"
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
