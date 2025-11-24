import { Hono } from "hono"

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

interface ProductsResponse {
  products: Product[]
}

const loadProducts = async (): Promise<ProductsResponse> => {
  const response = await fetch("https://dummyjson.com/products")
  if (!response.ok) throw new Error(response.statusText)
  return response.json()
}
const loadProduct = async (id: number): Promise<Product> => {
  const response = await fetch(`https://dummyjson.com/products/${id}`)
  if (!response.ok) throw new Error(response.statusText)
  return response.json()
}

export const apiRouter = new Hono()
  .get("/products", async (c) => {
    return c.json(await loadProducts())
  })
  .get("/products/:id", async (c) => {
    const id = Number(c.req.param("id"))
    return c.json(await loadProduct(id))
  })
