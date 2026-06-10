import { Link } from "kiru/router"

export default function Layout({ children }: { children: JSX.Children }) {
  return (
    <main data-testid="ssr-layout">
      <nav>
        <Link to="/">Home</Link>
        {" | "}
        <Link to="/loaders/server">Server loader</Link>
        {" | "}
        <Link to="/loaders/server-immediate-shell">Server loader immediate shell</Link>
        {" | "}
        <Link to="/forms/demo">Form action</Link>
        {" | "}
        <Link to="/about">About</Link>
        {" | "}
        <Link to="/docs">Docs (static)</Link>
        {" | "}
        <Link to="/loader-cache-demo">Loader cache</Link>
        {" | "}
        <Link to="/query-dedup-demo">Query dedup</Link>
        {" | "}
        <Link to="/threadboard">Threadboard</Link>
        {" | "}
        <Link to="/seo">SEO</Link>
        {" | "}
        <Link to="/head-override">Head override</Link>
        {" | "}
        <Link to="/users/99">User 99</Link>
        {" | "}
        <Link to="/guarded">Guarded</Link>
        {" | "}
        <Link to="/forbidden">Forbidden</Link>
        {" | "}
        <Link to="/blocked">Blocked (leave-guarded)</Link>
        {" | "}
        <Link to="/streaming-test">Streaming test</Link>
        {" | "}
        <Link to="/nested-streaming-test">Nested streaming</Link>
        {" | "}
        <Link to="/action-middleware-demo">Action middleware</Link>
        {" | "}
        <Link to="/ssr-break">SSR break</Link>
        {" | "}
        <Link to="/ssr-break-leaf">SSR break (leaf)</Link>
        {" | "}
        <Link to="/nav-break">Nav break</Link>
      </nav>
      {children}
    </main>
  )
}
