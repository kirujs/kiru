import { definePageConfig, Link, PageProps } from "kiru/router"
import { client } from "@/api"

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

export default function ProductsPage({
  data,
  loading,
}: PageProps<typeof config>) {
  if (loading) {
    console.log("loading")
    return <p>Loading...</p>
  }
  return (
    data && (
      <ul>
        {data.products.map((product) => (
          <li key={product.id} className="w-[420px]">
            <Link
              to={`/products/${product.id}`}
              style={`width:420px; display:block; view-transition-name: product-title-${product.id}`}
            >
              {product.title}
            </Link>
            <img
              src={product.thumbnail}
              alt={product.title}
              style={`height:300px; view-transition-name: product-image-${product.id}`}
            />
          </li>
        ))}
      </ul>
    )
  )
}
