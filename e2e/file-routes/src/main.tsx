import { createRouterApp } from "kiru/router/csr"
import { routes } from "./routes"

void createRouterApp({
  routes,
  container: document.getElementById("app")!,
})
