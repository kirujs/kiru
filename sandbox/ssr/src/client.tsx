import { createRouterApp } from "kiru/router/ssr"
import { routes } from "./routes"
import "./styles.css"

createRouterApp({ routes, container: document.getElementById("app")! })
