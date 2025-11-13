import { Hono } from "hono"
import { streamText } from "hono/streaming"

const app = new Hono()

app.get("*", async (c, next) => {
  const path = c.req.path
  console.log("path", path)

  try {
    // Import the render function from the virtual server entry
    // In development, this is loaded via Vite's SSR module loader
    // In production, this would be from the built server bundle
    const { render } = await import("virtual:kiru:entry-server")

    const { httpResponse } = await render(c.req.url, {
      registerModule: (moduleId: string) => {
        // Track modules for CSS collection
        console.log("Module registered:", moduleId)
      },
    })
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
        stream.onData((chunk: string) => res.write(chunk))
        await new Promise<void>((resolve) => stream.onFinished(resolve))
      }
    })
  } catch (error) {
    console.error("SSR Error:", error)
    return c.text("Internal Server Error", 500)
  }
})

export default app
