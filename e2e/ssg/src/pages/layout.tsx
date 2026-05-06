import { Link } from "kiru/router"

export default function Layout({ children }: { children: JSX.Children }) {
  return (
    <main data-testid="ssg-layout">
      <nav>
        <Link to="/">Home</Link>
      </nav>
      {children}
    </main>
  )
}
