import { ErrorBoundary, Suspense, usePromise } from "kiru"
import type { AppType } from "@/server/hono-entry"
import { hc } from "hono/client"
import { definePageConfig, PageProps, useFileRouter } from "kiru/router"

const client = hc<AppType>(
  import.meta.env.DEV ? "http://localhost:5173" : "http://localhost:3000"
)

export const config = definePageConfig({
  loader: {
    load: async ({ params, signal }) => {
      const response = await client.api.products[":id"].$get(
        { param: { id: params.id } },
        { init: { signal } }
      )
      if (!response.ok) throw new Error(response.statusText)
      return await response.json()
    },
    cache: {
      type: "memory",
      ttl: 1000 * 60 * 5,
    },
  },
})

export default function ProductPage({ data }: PageProps<typeof config>) {
  const router = useFileRouter()
  return (
    data && (
      <div>
        <h1>Product {router.state.params.id}</h1>
        <p>{data.title}</p>
        <p>{data.description}</p>
        <img src={data.thumbnail} alt={data.title} />
      </div>
    )
  )
}
