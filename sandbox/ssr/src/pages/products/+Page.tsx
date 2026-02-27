import { Derive, statefulPromise } from "kiru"

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

export function Page() {
  const products = statefulPromise<ProductsResponse>(async (signal) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const response = await fetch("https://dummyjson.com/products", { signal })
    if (!response.ok) throw new Error(response.statusText)
    return await response.json()
  })

  return () => (
    <Derive from={products} fallback={<div>Loading...</div>}>
      {(data, isStale) => (
        <ul className={isStale ? "opacity-50" : ""}>
          {data.products.map((product) => (
            <li key={product.id}>{product.title}</li>
          ))}
        </ul>
      )}
    </Derive>
  )
}
