import { Link } from "kiru/router"

export default function RootLayout({ children }: { children: JSX.Children }) {
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
      <div id="router-outlet">{children}</div>
    </main>
  )
}
