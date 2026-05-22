import { Link } from "kiru/router"
import { routeLinks } from "../routes"

export default function RootLayout({ children }: { children: JSX.Children }) {
  return (
    <main>
      <nav>
        <ul>
          {routeLinks.map((link) => (
            <li key={link.displayName}>
              {"params" in link ? (
                <Link
                  to={link.path}
                  params={link.params}
                  data-testid={`nav-${link.displayName}`}
                >
                  {link.displayName}
                </Link>
              ) : (
                <Link to={link.path} data-testid={`nav-${link.displayName}`}>
                  {link.displayName}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <div id="router-outlet">{children}</div>
    </main>
  )
}
