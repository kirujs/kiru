import { Body, Head } from "kiru/router"
import "../style.css"

export default function Document() {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Head.Outlet />
      </head>
      <Body.Outlet />
    </html>
  )
}
