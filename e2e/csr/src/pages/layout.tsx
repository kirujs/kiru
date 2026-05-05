import { routes } from "../routes"

export default function RootLayout({ children }: { children: JSX.Children }) {
  return (
    <main>
      <header>
        <h1>Hello World</h1>
      </header>
      <nav>
        <ul>
          {Object.entries(routes).map(([path, { displayName }]) => (
            <li>
              <Link to={path}>{displayName}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <div id="router-outlet">{children}</div>
    </main>
  )
}

function Link({ to, children }: { to: string; children: JSX.Children }) {
  return (
    <a
      href={to}
      onclick={(e) => {
        e.preventDefault()
        window.history.pushState(null, "", to)
        window.dispatchEvent(new Event("popstate"))
      }}
    >
      {children}
    </a>
  )
}
