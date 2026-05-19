import { Link } from "kiru/router"

export default function Layout({ children }: { children: JSX.Children }) {
  return (
    <main data-testid="ssg-layout">
      <nav>
        <Link to="/">Home</Link>
        {" | "}
        <Link to="/about">About</Link>
        {" | "}
        <Link to="/posts/one">Post one</Link>
        {" | "}
        <Link to="/loaders/static">Static loader</Link>
      </nav>
      {children}
    </main>
  )
}
