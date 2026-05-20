import { createRouterApp } from "kiru/router/ssr"
import { routes } from "./routes"
import "./styles.css"

void createRouterApp({ routes, container: document.getElementById("app")! })
