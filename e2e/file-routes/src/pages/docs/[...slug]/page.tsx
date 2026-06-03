import { useRouter } from "kiru/router"

export default function DocsCatchAll() {
  const router = useRouter()
  return () => (
    <h2 data-testid="fbr-docs">Docs: {() => router.params.value.slug}</h2>
  )
}
