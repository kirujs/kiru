import { ErrorBoundary, Suspense, usePromise } from "kiru"
import type { AppType } from "@/server/hono-entry"
import { hc } from "hono/client"

const client = hc<AppType>("http://localhost:5173")

export default function ProductsPage() {
  const products = usePromise(async ({ signal }) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const response = await client.api.products.$get({ signal })
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
          <>
            <ul>
              {data.products.map((product) => (
                <li key={product.id}>{product.title}</li>
              ))}
            </ul>
          </>
        )}
      </Suspense>
    </ErrorBoundary>
  )
}
