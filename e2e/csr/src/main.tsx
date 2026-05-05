import "./style.css"
import { Derive, mount, resource, signal } from "kiru"
import { routes } from "./routes"
import RootLayout from "./pages/layout"

const App = () => {
  const pathname = signal(window.location.pathname)
  const routeModule = resource(() => routes[pathname.value].component())
  window.addEventListener("popstate", () => {
    pathname.value = window.location.pathname
  })

  return () => (
    <RootLayout>
      <Derive from={routeModule}>{(module) => <module.default />}</Derive>
    </RootLayout>
  )
}

mount(<App />, document.getElementById("app")!)
