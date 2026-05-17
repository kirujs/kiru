import { createRouterApp } from "kiru/router/csr"
import { routes } from "./routes"
import "./index.css"

createRouterApp({ routes, container: document.getElementById("app")! })
