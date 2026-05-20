import { createRouterApp } from "kiru/router/csr"
import { routes } from "./routes"
import "./index.css"

void createRouterApp({ routes, container: document.getElementById("app")! })
