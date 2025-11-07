```jsx
import { Body, Head } from "kiru/router"
import "../styles.css"

export default function Document() {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <Head.Outlet />
      </head>
      <Body.Outlet />
    </html>
  )
}
```
