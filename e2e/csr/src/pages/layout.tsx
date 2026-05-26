import { Link } from "kiru/router"
import { routeLinks } from "../routes"

export default function RootLayout({ children }: { children: JSX.Element }) {
  return (
    <main>
      <header>
        <h1>Hello World</h1>
      </header>
      <nav>
        <ul>
          {routeLinks.map(({ path, displayName }) => (
            <li>
              <Link to={path} data-testid={`nav-${displayName}`}>
                {displayName}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div id="router-outlet">{children}</div>
    </main>
  )
}
