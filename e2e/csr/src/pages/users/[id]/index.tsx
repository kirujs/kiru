import { useRouter } from "kiru/router"

export default function UserPage() {
  const router = useRouter()
  return () => (
    <h2 data-testid="csr-user">User {() => router.params().id}</h2>
  )
}
