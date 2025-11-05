import { Body, Head } from "kiru/router"
import "$/styles/global.css"

export default function Document() {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/** @ts-ignore */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <meta property="og:title" content="Kiru" />
        <meta
          property="og:description"
          content="A powerful, easy-to-use rendering library with a tiny footprint"
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:image"
          content="https://kirujs.dev/kiru-splash.png"
        />
        <meta name="darkreader-lock" />
        <Head.Outlet />
      </head>
      <Body.Outlet />
    </html>
  )
}
