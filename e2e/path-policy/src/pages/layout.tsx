import { Link } from "kiru/router"

export default function RootLayout({ children }: { children: JSX.Children }) {
  return (
    <main>
      <nav>
        <Link to="/" data-testid="nav-home">
          home
        </Link>
        <Link to="/about" data-testid="nav-about">
          about
        </Link>
      </nav>
      <div id="router-outlet">{children}</div>
    </main>
  )
}
