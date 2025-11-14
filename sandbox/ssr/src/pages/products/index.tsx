import { ErrorBoundary, Suspense, usePromise } from "kiru"
import type { AppType } from "@/server/hono-entry"
import { hc } from "hono/client"
import { definePageConfig, Link, PageProps } from "kiru/router"

const client = hc<AppType>(
  import.meta.env.DEV ? "http://localhost:5173" : "http://localhost:3000"
)

export const config = definePageConfig({
  loader: {
    load: async ({ signal }) => {
      const response = await client.api.products.$get({ signal })
      if (!response.ok) throw new Error(response.statusText)
      return await response.json()
    },
    cache: {
      type: "memory",
      ttl: 1000 * 60 * 5,
    },
  },
})

export default function ProductsPage({ data }: PageProps<typeof config>) {
  return (
    data && (
      <>
        <ul>
          {data.products.map((product) => (
            <li key={product.id}>
              <Link to={`/products/${product.id}`}>{product.title}</Link>
              <img src={product.thumbnail} />
            </li>
          ))}
        </ul>
      </>
    )
  )
}
