import { useAsync, useState } from "kiru"
import { Spinner } from "./atoms/Spinner"
import { Button } from "./atoms/Button"

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

export default function UseAsyncExample() {
  const [count, setCount] = useState(0)
  const [productId, setProductId] = useState(1)
  const { data, loading, error, invalidate } = useAsync<Product>(
    async ({ abortSignal }) => {
      const res = await fetch(`https://dummyjson.com/products/${productId}`, {
        signal: abortSignal,
      })
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    },
    [productId]
  )

  return (
    <div>
      <Button onclick={() => setCount((prev) => prev + 1)}>
        Increment: {count}
      </Button>
      <Button onclick={() => setProductId((prev) => prev + 1)}>
        Next ({productId})
      </Button>
      <Button onclick={invalidate}>Reload</Button>
      {data ? (
        <ProductCard product={data} />
      ) : loading ? (
        <Spinner />
      ) : (
        <p>{error.message}</p>
      )}
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div>
      <h1>
        {product.title} <sup>({product.id})</sup>
      </h1>
      <p>{product.description}</p>

      <img src={product.thumbnail} />
    </div>
  )
}
