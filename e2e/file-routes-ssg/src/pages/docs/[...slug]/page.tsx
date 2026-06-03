import { useRouter } from "kiru/router"

export async function generateStaticParams() {
  return [{ slug: "a/b/c" }]
}

export default function DocsCatchAll() {
  const router = useRouter()
  return () => (
    <h2 data-testid="fbr-docs">Docs: {() => router.params.value.slug}</h2>
  )
}
