import { definePageConfig, useFileRouter } from "kiru/router"

export const config = definePageConfig({
  generateStaticParams: () => {
    return [{ slug: "post-1" }, { slug: "post-2" }, { slug: "post-3" }]
  },
})

export default function BlogCatchall() {
  const { state } = useFileRouter()
  return (
    <div>
      <h1>Blog Catchall Route</h1>
      <p>Caught slug: {state.params.slug}</p>
    </div>
  )
}
