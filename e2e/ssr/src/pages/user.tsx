import { useRouter } from "kiru/router"

export default function UserPage() {
  const router = useRouter()
  return (
    <p data-testid="ssr-user-route">
      SSR user id: {() => router.params.value.id}
    </p>
  )
}
