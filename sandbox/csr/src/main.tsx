import "./index.css"
import { mount } from "kiru"
import { createRouter, RouterProvider, RouterView } from "kiru/router"
import { routes } from "./routes"

const router = createRouter({ routes })

mount(
  <RouterProvider router={router}>
    <RouterView />
  </RouterProvider>,
  document.getElementById("app")!
)
