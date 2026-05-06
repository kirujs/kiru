import { bootstrapSsgClient } from "kiru/ssr/router"
import { routes } from "./routes"
import "./style.css"

void bootstrapSsgClient({
  routes,
  container: document.getElementById("app")!,
})
