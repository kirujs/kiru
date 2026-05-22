import { createRouterApp } from "kiru/router/ssg"
import { routes } from "./routes"

void createRouterApp({
  routes,
  container: document.getElementById("app")!,
})
