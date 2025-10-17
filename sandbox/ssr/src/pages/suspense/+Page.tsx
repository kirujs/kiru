import { Suspense, useId, usePromise, useState } from "kiru"

interface Product {
  id: number
  title: string
  thumbnail: string
}

async function loadProduct(id: number, signal: AbortSignal): Promise<Product> {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const request = await fetch(`https://dummyjson.com/products/${id}`, {
    signal,
  })
  if (!request.ok) throw new Error(request.statusText)
  return request.json()
}

export function Page() {
  const [productId, setProductId] = useState(1)
  const productDataPromise = usePromise(
    ({ signal }) => loadProduct(productId, signal),
    [productId]
  )

  return (
    <div>
      <Suspense data={[productDataPromise]} fallback={<div>Loading...</div>}>
        {(pdata) => (
          <div>
            <h1>{pdata.title}</h1>
            <img src={pdata.thumbnail} />
          </div>
        )}
      </Suspense>
      <div className="flex justify-between">
        <button
          disabled={productId === 1}
          onclick={() => setProductId((prev) => prev - 1)}
        >
          Prev
        </button>
        <button onclick={() => setProductId((prev) => prev + 1)}>Next</button>
      </div>
    </div>
  )
}
