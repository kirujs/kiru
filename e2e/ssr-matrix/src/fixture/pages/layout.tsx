export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <nav>
        <a href="/">Home</a> · <a href="/hello">Hello</a>
      </nav>
      {children}
    </main>
  )
}
