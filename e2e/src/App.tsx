import { Link, Route, Router } from "kaioken/router"
import { Counter } from "./Counter"
import { MemoTest } from "./MemoTest"
import { TodoList } from "./Todos"
import { EffectsTest } from "./EffectsTest"

export function App() {
  return (
    <main>
      <header>
        <h1>Hello World</h1>
      </header>
      <nav>
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/about">About</Link>
          </li>
          <li>
            <Link to="/counter">Counter</Link>
          </li>
          <li>
            <Link to="/todos">Todos</Link>
          </li>
          <li>
            <Link to="/memo">Memo</Link>
          </li>
        </ul>
      </nav>
      <div id="router-outlet">
        <Router>
          <Route path="/" element={<h2>Home</h2>} />
          <Route path="/about" element={<h2>About</h2>} />
          <Route path="/counter" element={<Counter />} />
          <Route path="/todos" element={<TodoList />} />
          <Route path="/memo" element={<MemoTest />} />
          <Route path="/effects" element={<EffectsTest />} />
        </Router>
      </div>
    </main>
  )
}
