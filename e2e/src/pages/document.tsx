import "../style.css"

export default function Document({ children }: { children?: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Kiru E2E Sandbox</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
