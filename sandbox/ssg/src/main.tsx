import { createRouterApp } from "kiru/router/ssg"
import { routes } from "./routes"
import "./styles.css"

createRouterApp({ routes, container: document.getElementById("app")! })
