import "dotenv/config"
import { Hono } from "hono"
import { streamText } from "hono/streaming"

import { renderPage } from "vike/server"

const app = new Hono()

app.all("*", async (c, next) => {
  const { httpResponse, stream } = await renderPage({ urlOriginal: c.req.url })
  if (httpResponse === null) return next()

  const { body, statusCode, headers } = httpResponse

  return streamText(c, async (res) => {
    c.status(statusCode)
    headers.forEach(([name, value]) => c.header(name, value))

    await res.write(body)
    if (stream) {
      return res.pipe(stream)
    }
  })
})

export default app
