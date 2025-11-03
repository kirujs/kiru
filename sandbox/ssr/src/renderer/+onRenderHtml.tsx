// Environment: server
import type { PageContextServer } from "vike/types"
import { dangerouslySkipEscape, escapeInject } from "vike/server"
import { renderToString } from "kiru"
import { getTitle } from "./utils"
import { App } from "./App"
import { renderToReadableStream } from "kiru/ssr/server"

export const onRenderHtml = (pageContext: PageContextServer) => {
  const { immediate, stream } = renderToReadableStream(
    <App pageContext={pageContext} />
  )
  pageContext.stream = stream
  return escapeInject`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <link rel="icon" href="/favicon.svg">
        <title>${getTitle(pageContext)}</title>
      </head>
      <body>
        <div id="page-root">${dangerouslySkipEscape(immediate)}</div>
      </body>
    </html>`
}
