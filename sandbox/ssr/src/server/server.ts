import { Hono } from "hono"
import { streamText } from "hono/streaming"

const app = new Hono()

app.get("*", async (c, next) => {
  console.log("render", c.req.path)
  // todo: do the thing
  const { httpResponse } = await render({ url: c.req.url })
  console.log("httpResponse", c.req.path, httpResponse)
  if (httpResponse === null) return next()

  const { html, headers, statusCode, stream } = httpResponse

  return streamText(c, async (res) => {
    c.status(statusCode)
    headers.forEach(([name, value]) => c.header(name, value))

    await res.write(html)
    // write lazy content as it resolves
    if (stream) {
      stream.onData((chunk: string) => res.write(chunk))
      await new Promise<void>((resolve) => stream.onFinished(resolve))
    }
  })
})

export default app
