import { useRouter } from "kiru/router"

export default function UserPage({ id }: { id?: string }) {
  const router = useRouter() as any
  const value = id ?? router.params.value.id ?? "unknown"
  return <p data-testid="ssr-user-route">SSR user id: {value}</p>
}
