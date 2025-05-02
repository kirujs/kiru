export function Navbar() {
  return (
    <nav className="flex gap-4 p-4">
      <a className="text-sm underline" href="/">
        Home
      </a>
      <a className="text-sm underline" href="/counter">
        Counter
      </a>
      <a className="text-sm underline" href="/products">
        Products
      </a>
      <a className="text-sm underline" href="/swr">
        SWR
      </a>
      <a className="text-sm underline" href="/form">
        Form
      </a>
    </nav>
  )
}
