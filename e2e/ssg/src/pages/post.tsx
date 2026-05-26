import { useRouter } from "kiru/router"
import type { GenerateStaticParamsContext } from "kiru/router"

export function generateStaticParams(_ctx: GenerateStaticParamsContext) {
  return [{ slug: "one" }, { slug: "two" }]
}

export default function PostPage() {
  const router = useRouter()
  return () => (
    <>
      <p data-testid="ssg-post">SSG post: {() => router.params().slug}</p>
      <p data-testid="ssg-loader">{() => `post:${router.params().slug}`}</p>
    </>
  )
}
