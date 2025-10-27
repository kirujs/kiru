export default function Document({ children }: { children?: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Kiru SSG Sandbox</title>
        <link rel="stylesheet" href="/src/index.css" type="text/css" />
      </head>
      <body>{children}</body>
    </html>
  )
}
