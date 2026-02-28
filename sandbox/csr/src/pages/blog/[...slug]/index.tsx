import { computed } from "kiru"
import { useFileRouter } from "kiru/router"

export default function BlogCatchall() {
  const { state } = useFileRouter()
  const slug = computed(() => state.params.value["slug"])

  return () => (
    <div>
      <h1>Blog Catchall Route</h1>
      <p>Caught slug: {slug}</p>
    </div>
  )
}
