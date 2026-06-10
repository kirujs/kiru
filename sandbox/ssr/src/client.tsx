import { createRouterApp } from "kiru/router/ssr"
import { installE2eRouterDiagnostics } from "../../../e2e/shared/routerDiagnostics.js"
import { routes } from "./routes"
import "./styles.css"

installE2eRouterDiagnostics()

void createRouterApp({ routes, container: document.getElementById("app")! })
