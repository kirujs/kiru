import { definePageConfig, PageProps, useFileRouter } from "kiru/router"
import { client } from "@/api"

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

export default function ProductPage({
  data,
  loading,
}: PageProps<typeof config>) {
  const router = useFileRouter()
  const id = router.state.params.id
  if (loading) return <p>Loading...</p>
  return (
    data && (
      <div className="w-[420px]">
        <h1>Product {id}</h1>
        <p
          style={`width:420px; display:block; view-transition-name: product-title-${id}`}
        >
          {data.title}
        </p>
        <p>{data.description}</p>
        <img
          src={data.thumbnail}
          alt={data.title}
          style={`height:300px; view-transition-name: product-image-${id}`}
        />
      </div>
    )
  )
}
