import { createRouterApp } from "kiru/router/ssg"
import { routes } from "./routes"
import "./styles.css"

void createRouterApp({ routes, container: document.getElementById("app")! })
