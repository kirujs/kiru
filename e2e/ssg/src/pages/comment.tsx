import { useRouter } from "kiru/router"
import type { GenerateStaticParamsContext } from "kiru/router"

export function generateStaticParams({ params }: GenerateStaticParamsContext) {
  return [{ id: `${params.slug}-c1` }, { id: `${params.slug}-c2` }]
}

export default function CommentPage() {
  const router = useRouter()
  return (
    <p data-testid="comment">
      {router.params.value.slug}:{router.params.value.id}
    </p>
  )
}
