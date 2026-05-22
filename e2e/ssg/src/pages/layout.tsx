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
        {" | "}
        <Link to="/hash-section">Hash section</Link>
        {" | "}
        <Link to="/forbidden">Forbidden</Link>
        {" | "}
        <Link to="/guarded">Guarded</Link>
        {" | "}
        <Link to="/break-leaf">Break</Link>
        {" | "}
        <Link to="/invalidate-demo">Invalidate demo</Link>
        {" | "}
        <Link to="/context">Context</Link>
        {" | "}
        <Link to="/context/admin">Context admin</Link>
        {" | "}
        <Link to="/context/profile">Context profile</Link>
      </nav>
      {children}
    </main>
  )
}
