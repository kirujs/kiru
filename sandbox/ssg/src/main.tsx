import { bootstrapSsgClient } from "kiru/ssr/router"
import { routes } from "./routes"
import "./styles.css"

void bootstrapSsgClient({
  routes,
  container: document.getElementById("app")!,
})
