import { Router, Route, Link } from "kiru/router"
import { ROUTES } from "./routes"
import { signal, useComputed, useEffect, watch } from "kiru"

import { onHMR } from "vite-plugin-kiru"

let interval = setInterval(() => console.log("interval"), 1000)

onHMR(() => {
  console.log("onHMR")
  clearInterval(interval)
})

const state = {
  count: signal(0),
  greeting: signal("Hello world!"),
  foo: {
    bar: signal(123),
  },
}
watch(() => {
  console.log("~~~~~ count changed 123 45 asd", state.count.value)
})

const Home = () => {
  const doubled = useComputed(() => {
    console.log("doubled")
    return state.count.value * 2
  })
  useEffect(() => {
    console.log("Home mounted")
  }, [])

  return (
    <div
      style={{
        display: undefined,
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h1>{state.greeting}</h1>
      <p>Count: {state.count}</p>
      <p>Doubled: {doubled}</p>
      <button onclick={() => state.count.value++}>Increment</button>
    </div>
  )
}

function Nav() {
  return (
    <nav className=" min-h-screen p-2  mb-5 h-full">
      <div className="sticky top-0 flex flex-col gap-2">
        <Link to={"/"}>Home</Link>
        {Object.entries(ROUTES).map(([path, route]) => (
          <Link key={route.title} to={path}>
            {route.title}
          </Link>
        ))}
        <Link to="/unhandled-route">Unhandled route</Link>
      </div>
    </nav>
  )
}

export function App() {
  return (
    <>
      <Nav />
      <main className="flex items-center justify-center flex-grow w-full">
        <Router>
          <Route path="/" element={<Home />} />
          {Object.entries(ROUTES).map(([path, route]) => (
            <Route
              key={path}
              path={path}
              element={<route.component />}
              fallthrough={route.fallthrough}
            />
          ))}
          <Route path="*" element={<h1>Uh-oh! Page not found :C</h1>} />
        </Router>
      </main>
    </>
  )
}
