import { Suspense, usePromise } from "kiru"

interface ProductsResponse {
  products: {
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
  }[]
}

export default function ProductsPage() {
  const products = usePromise<ProductsResponse>(async ({ signal }) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const response = await fetch("https://dummyjson.com/products", { signal })
    if (!response.ok) throw new Error(response.statusText)
    return await response.json()
  }, [])

  return (
    <Suspense data={products.data} fallback={<div>Loading...</div>}>
      {(data) => (
        <ul>
          {data.products.map((product) => (
            <li key={product.id}>{product.title}</li>
          ))}
        </ul>
      )}
    </Suspense>
  )
}
