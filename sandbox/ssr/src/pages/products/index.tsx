import { ErrorBoundary, Suspense, usePromise } from "kiru"

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
    const response = await fetch("http://localhost:5173/api/products", {
      signal,
    })
    if (!response.ok) throw new Error(response.statusText)
    return await response.json()
  }, [])

  return (
    <ErrorBoundary
      onError={console.error}
      fallback={
        <div>
          <p>Something went wrong 😿</p>
          <button onclick={() => products.refresh()}>Retry</button>
        </div>
      }
    >
      <Suspense data={products.data} fallback={<div>Loading...</div>}>
        {(data) => (
          <ul>
            {data.products.map((product) => (
              <li key={product.id}>{product.title}</li>
            ))}
          </ul>
        )}
      </Suspense>
    </ErrorBoundary>
  )
}
