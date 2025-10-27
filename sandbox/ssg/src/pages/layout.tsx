import { Link } from "kiru/router"
import "../index.css"

export default function RootLayout({ children }: { children: JSX.Children }) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/vite.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vite + TS</title>
        <link rel="stylesheet" href="/src/index.css" type="text/css" />
      </head>
      <body>
        <header>
          <h1>My App</h1>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/users">Users</Link>
            <Link to="/blog">Blog</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <p>&copy; 2024 My App</p>
        </footer>
        <script type="module" src="/src/entry-client.tsx"></script>
      </body>
    </html>
  )
}
