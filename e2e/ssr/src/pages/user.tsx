import { useRouter, type GenerateSitemapParamsContext } from "kiru/router"

export function generateSitemapParams(_ctx: GenerateSitemapParamsContext) {
  return [{ id: "1" }]
}

export default function UserPage() {
  const router = useRouter()
  return (
    <p data-testid="ssr-user-route">
      SSR user id: {() => router.params.value.id}
    </p>
  )
}
