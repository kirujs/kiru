import { Link } from "kiru/router"
import "../index.css"

export default function RootLayout({ children }: { children: JSX.Children }) {
  return (
    <div id="app">
      <header>
        <h1>My App</h1>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/users">Users</Link>
          <Link to="/blog">Blog</Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <p>&copy; 2024 My App</p>
      </footer>
    </div>
  )
}
