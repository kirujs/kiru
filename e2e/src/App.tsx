import { Link, Route, Router } from "kiru/router"
import { Counter } from "./Counter"
import { MemoTest } from "./MemoTest"
import { TodoList } from "./Todos"
import { EffectsTest } from "./EffectsTest"
import { StyleTest } from "./StyleTest"
import { SignalsTest } from "./SignalsTest"

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
          <li>
            <Link to="/signals">Signals</Link>
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
          <Route path="/style" element={<StyleTest />} />
          <Route path="/signals" element={<SignalsTest />} />
        </Router>
      </div>
    </main>
  )
}
