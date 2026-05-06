import { bootstrapSsrClient } from "kiru/ssr/router"
import { routes } from "./routes"
import "./styles.css"

void bootstrapSsrClient({
  routes,
  container: document.getElementById("app")!,
})
