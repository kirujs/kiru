import { useRouter } from "kiru/router"

export default function UrlStatePage() {
  const router = useRouter()
  return () => (
    <p data-testid="url-state">
      {router.pathname()}:{router.params().id}:{router.hash()}:
      {router.query().tag?.join(",")}
    </p>
  )
}
