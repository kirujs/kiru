import { useRouter } from "kiru/router"

export default function UrlStatePage() {
  const router = useRouter()
  return () => (
    <p data-testid="url-state">
      {router.pathname.value}:{router.params.value.id}:{router.hash.value}:
      {router.query.value.tag?.join(",")}
    </p>
  )
}
