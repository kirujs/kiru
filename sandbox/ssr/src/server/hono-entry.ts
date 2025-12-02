import { Hono } from "hono"
import { streamText } from "hono/streaming"
import { renderPage, getServerActionResponse } from "vite-plugin-kiru/server"
import apiRouter, { authCookieParserMiddleware } from "./api"
import { createMiddleware } from "hono/factory"
import type { User } from "./services/user"

declare global {
  namespace Kiru {
    interface RequestContext {
      user: User | null
    }
  }
}

const kiruServerActions = createMiddleware(async (c, next) => {
  const { httpResponse } = await getServerActionResponse(c.req.raw)
  if (httpResponse === null) {
    return next()
  }

  const { body, statusCode } = httpResponse
  if (statusCode !== 200) {
    return c.status(statusCode)
  }
  return c.json(body, statusCode)
})

const app = new Hono()
  .route("/api", apiRouter)
  .use(kiruServerActions)
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
        headers.forEach(([k, v]: [string, string]) => c.header(k, v))

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
