export default function Layout({ children }: { children: JSX.Element }) {
  return (
    <main>
      <nav>
        <a href="/">Home</a> · <a href="/hello">Hello</a>
      </nav>
      {children}
    </main>
  )
}
