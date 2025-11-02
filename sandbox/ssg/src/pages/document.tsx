import { Head } from "kiru/router"
import "../index.css"

export default function Document({ children }: { children?: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Kiru SSG Sandbox</title>
        <Head.Outlet />
      </head>
      <body>{children}</body>
    </html>
  )
}
