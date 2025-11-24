import { Hono } from "hono"
import { streamText } from "hono/streaming"
import { renderPage } from "vite-plugin-kiru/server"

interface Product {
  id: number
  title: string
  description: string
  price: number
  discountPercentage: number
  rating: number
  stock: number
  brand: string
  category: string
  thumbnail: string
  images: string[]
}

interface ProductResponse extends Product {}

interface ProductsResponse {
  products: Product[]
}

const loadProducts = async () => {
  // await new Promise((resolve) => setTimeout(resolve, 500))
  const response = await fetch("https://dummyjson.com/products")
  if (!response.ok) throw new Error(response.statusText)
  return (await response.json()) as ProductsResponse
}
const loadProduct = async (id: number) => {
  // await new Promise((resolve) => setTimeout(resolve, 500))
  const response = await fetch(`https://dummyjson.com/products/${id}`)
  if (!response.ok) throw new Error(response.statusText)
  return (await response.json()) as ProductResponse
}

const app = new Hono()
  .get("/api/products", async (c) => {
    const products = await loadProducts()
    return c.json(products)
  })
  .get("/api/products/:id", async (c) => {
    const id = Number(c.req.param("id"))
    const product = await loadProduct(id)
    return c.json(product)
  })
  .get("*", async (c, next) => {
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
