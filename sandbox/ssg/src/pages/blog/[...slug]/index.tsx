import { useFileRouter } from "kiru/router"

export default function BlogCatchall() {
  const { state } = useFileRouter()
  return (
    <div>
      <h1>Blog Catchall Route</h1>
      <p>Caught slug: {state.params.slug}</p>
    </div>
  )
}
