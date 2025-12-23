import { Head, Body } from "kiru/router"
import "../index.css"

export default function Document() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Head.Outlet />
      </head>
      <Body.Outlet />
    </html>
  )
}
