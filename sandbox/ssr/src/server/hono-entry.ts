import { Hono } from "hono"
import { streamText } from "hono/streaming"
import { renderPage } from "vite-plugin-kiru/server"

const app = new Hono()

app.get("*", async (c, next) => {
  const path = c.req.path
  console.log("path", path)

  try {
    const { httpResponse } = await renderPage({ url: c.req.url })
    if (httpResponse === null) return next()

    console.log("httpResponse", path, httpResponse)

    const { html, headers, statusCode, stream } = httpResponse

    return streamText(c, async (res) => {
      c.status(statusCode as any)
      headers.forEach(([name, value]: [string, string]) =>
        c.header(name, value)
      )

      await res.write(html)
      // write lazy content as it resolves
      if (stream) {
        stream.on("data", (chunk) => res.write(chunk))
        await new Promise((resolve) => stream.on("end", resolve))
      }
    })
  } catch (error) {
    console.error("SSR Error:", error)
    return c.text("Internal Server Error", 500)
  }
})

export default app
