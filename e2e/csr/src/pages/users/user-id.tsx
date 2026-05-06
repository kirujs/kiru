import { useRouter } from "kiru/router"

export default function UserPage({ id }: { id?: string }) {
  const router = useRouter() as any
  const userId = id ?? router.params.value.id
  return <h2 data-testid="csr-user">User {userId}</h2>
}
