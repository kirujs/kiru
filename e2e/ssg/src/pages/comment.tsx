import { useRouter } from "kiru/router"

export default function CommentPage() {
  const router = useRouter()
  return (
    <p data-testid="comment">
      {router.params.value.slug}:{router.params.value.id}
    </p>
  )
}
