import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { renderPage } from "vike/server"
import express from "express"
import compression from "compression"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isProduction = process.env.NODE_ENV === "production"
const root = __dirname

startServer()

async function startServer() {
  const app = express()
  app.use(compression())

  if (isProduction) {
    app.use(express.static(`${root}/dist/client`, { redirect: false }))
  } else {
    // Instantiate Vite's development server and integrate its middleware to our server.
    // ⚠️ We should instantiate it *only* in development. (It isn't needed in production
    // and would unnecessarily bloat our server in production.)
    const vite = await import("vite")
    const viteDevMiddleware = (
      await vite.createServer({
        root,
        server: { middlewareMode: true },
      })
    ).middlewares
    app.use(viteDevMiddleware)
  }

  /**
   * Vike route
   *
   * @link {@see https://vike.dev}
   **/
  app.all("*", async (req, res, next) => {
    const pageContextInit = { urlOriginal: req.originalUrl }
    const pageContext = await renderPage(pageContextInit)
    if (pageContext.httpResponse === null) return next()

    const { statusCode, headers, earlyHints } = pageContext.httpResponse
    if (res.writeEarlyHints)
      res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
    res.status(statusCode)
    headers.forEach(([name, value]) => res.setHeader(name, value))

    pageContext.httpResponse.pipe(res)
  })

  const port = parseInt(process.env.PORT || "5173")

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`)
  })
}
