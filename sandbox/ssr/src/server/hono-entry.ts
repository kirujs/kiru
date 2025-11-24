import { Hono } from "hono"
import { streamText } from "hono/streaming"
import { renderPage } from "vite-plugin-kiru/server"
import { apiRouter } from "./api"

declare global {
  namespace Kiru {
    interface RequestContext {
      test: number
    }
  }
}

const app = new Hono().route("/api", apiRouter).get("*", async (c, next) => {
  try {
    const { httpResponse } = await renderPage({
      url: c.req.url,
      context: { test: Math.random() },
    })
    if (httpResponse === null) return next()

    const { html, headers, statusCode, stream } = httpResponse

    return streamText(c, async (res) => {
      c.status(statusCode as any)
      headers.forEach(([name, value]: [string, string]) =>
        c.header(name, value)
      )

      await res.write(html)
      if (stream) {
        return res.pipe(stream)
      }
    })
  } catch (error) {
    console.error("SSR Error:", error)
    return c.text("Internal Server Error", 500)
  }
})

export default app

export type AppType = typeof app
