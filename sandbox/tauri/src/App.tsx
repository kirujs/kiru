import { Router, Route, Link } from "kiru"
import { Counter } from "./Counter"

export function App() {
  return (
    <div className="text-center">
      <nav className="flex gap-2 justify-center">
        <Link className="p-2 text-blue-500" to="/">
          Home
        </Link>
        <Link className="p-2 text-blue-500" to="/counter">
          Counter
        </Link>
      </nav>
      <main className="p-2">
        <Router>
          <Route
            path="/"
            element={<div className="text-xl font-bold">Hello world!</div>}
          />
          <Route path="/counter" element={<Counter />} />
        </Router>
      </main>
    </div>
  )
}
