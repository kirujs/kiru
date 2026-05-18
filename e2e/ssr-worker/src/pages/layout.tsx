export default function Layout({ children }: { children: JSX.Children }) {
  return (
    <main>
      <nav>
        <a href="/">Home</a> | <a href="/docs">Docs</a> |{" "}
        <a href="/hello">Hello</a>
      </nav>
      {children}
    </main>
  )
}
