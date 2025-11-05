```jsx
import { useState, useAsync } from "kiru"

function App() {
  const [productId, setProductId] = useState(1)

  // Use useAsync to run an async function whenever the productId changes
  const { data, loading, error, invalidate } = useAsync(
    async ({ abortSignal }) => {
      const response = await fetch(`https://dummyjson.com/products/${productId}`, {
        signal: abortSignal,
      })
      return await response.json()
    }
    [productId]
  )

  return (
    <div>
      <button onclick={() => setProductId((prev) => prev + 1)}>Next</button>
      {data ? (
        <ProductCard product={data} invalidate={invalidate} />
      ) : loading ? (
        <p>Loading...</p>
      ) : (
        <p>{error.message}</p>
      )}
    </div>
  )
}
```
