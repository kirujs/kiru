import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import express from "express"
import { renderPage, createDevMiddleware } from "vike/server"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isProduction = process.env.NODE_ENV === "production"
const root = resolve(__dirname, "..")

startServer()

async function startServer() {
  const app = express()

  if (isProduction) {
    app.use(express.static(`${root}/dist/client`))
  } else {
    const { devMiddleware } = await createDevMiddleware({ root })
    app.use(devMiddleware)
  }

  /**
   * Vike route
   *
   * @link {@see https://vike.dev}
   **/
  app.all("*", async (req, res, next) => {
    const pageContextInit = { urlOriginal: req.originalUrl }
    const pageContext = await renderPage(pageContextInit)
    const { httpResponse } = pageContext
    if (httpResponse === null) return next()

    const { statusCode, headers, earlyHints } = httpResponse
    if (res.writeEarlyHints)
      res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
    res.status(statusCode)
    headers.forEach(([name, value]) => res.setHeader(name, value))

    httpResponse.pipe(res)
  })

  app.listen(process.env.PORT ? parseInt(process.env.PORT) : 3000, () => {
    console.log("Server listening on http://localhost:3000")
  })
}
