// Environment: server
import type { OnRenderHtmlAsync, PageContext } from "vike/types"
import { escapeInject } from "vike/server"
import { getTitle } from "./utils"
import { App } from "./App"
import { renderToReadableStream } from "kiru/ssr/server"

export const onRenderHtml = (pageContext: PageContext) => {
  return escapeInject`<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <link rel="icon" href="/favicon.svg">
        <title>${getTitle(pageContext)}</title>
      </head>
      <body>
        <div id="page-root">${renderToReadableStream(<App pageContext={pageContext} />)}</div>
        <div id="portal-root"></div>
      </body>
    </html>`
}
