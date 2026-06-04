import { Link, type LinkProps } from "kiru/router"
import { routeLinks } from "../routes"

export default function RootLayout({ children }: { children: JSX.Children }) {
  return (
    <main>
      <header>
        <h1>Hello World</h1>
      </header>
      <nav>
        <ul>
          {routeLinks.map((link) => (
            <li>
              <Link
                {...({
                  to: link.path,
                  ...("params" in link ? { params: link.params } : {}),
                  "data-testid": `nav-${link.displayName}`,
                  children: link.displayName,
                } as LinkProps)}
              />
            </li>
          ))}
        </ul>
      </nav>
      <div id="router-outlet">{children}</div>
    </main>
  )
}
