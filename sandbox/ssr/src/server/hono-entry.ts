import { Hono } from "hono"
import { streamText } from "hono/streaming"
import { renderPage } from "vite-plugin-kiru/server"

const app = new Hono()

const loadProducts = async () => {
  // await new Promise((resolve) => setTimeout(resolve, 500))
  const response = await fetch("https://dummyjson.com/products")
  if (!response.ok) throw new Error(response.statusText)
  return await response.json()
}

app.get("/api/products", async (c) => {
  const products = await loadProducts()
  return c.json(products)
})

app.get("*", async (c, next) => {
  try {
    const { httpResponse } = await renderPage({ url: c.req.url })
    if (httpResponse === null) return next()

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
