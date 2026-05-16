import { Link } from "kiru/router"

export default function Layout({ children }: { children: JSX.Children }) {
  return (
    <main data-testid="ssr-layout">
      <nav>
        <Link to="/">Home</Link>
        {" | "}
        <Link to="/hello">Loader</Link>
        {" | "}
        <Link to="/about">About</Link>
        {" | "}
        <Link to="/users/99">User 99</Link>
        {" | "}
        <Link to="/guarded">Guarded</Link>
        {" | "}
        <Link to="/blocked">Blocked (leave-guarded)</Link>
        {" | "}
        <Link to="/streaming-test">Streaming test</Link>
      </nav>
      {children}
    </main>
  )
}
