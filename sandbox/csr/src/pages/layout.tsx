import { Link } from "kiru/router"
export default function RootLayout() {
  const links = [
    { href: "/", text: "Home" },
    { href: "/about", text: "About" },
    { href: "/users", text: "Users" },
  ]

  return ({ children }: { children: JSX.Children }) => (
    <>
      <header>
        <nav>
          {links.map((link) => (
            <Link to={link.href}>{link.text}</Link>
          ))}
        </nav>
      </header>
      <main>{children}</main>
      <footer>Footer</footer>
    </>
  )
}
