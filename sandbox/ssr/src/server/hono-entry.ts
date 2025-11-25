import { Hono } from "hono"
import { streamText } from "hono/streaming"
import { renderPage } from "vite-plugin-kiru/server"
import apiRouter, { authCookieParserMiddleware } from "./api"
import type { User } from "./services/user"

declare global {
  namespace Kiru {
    interface RequestContext {
      user: User | null
    }
  }
}

const app = new Hono()
  .route("/api", apiRouter)
  .get("*", authCookieParserMiddleware, async (c, next) => {
    try {
      const { httpResponse } = await renderPage({
        url: c.req.url,
        context: {
          user: c.get("user"),
        },
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
