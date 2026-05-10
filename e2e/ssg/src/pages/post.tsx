import { useRouter } from "kiru/router"

export default function PostPage() {
  const router = useRouter()
  return () => (
    <>
      <p data-testid="ssg-post">SSG post: {() => router.params.value.slug}</p>
      <p data-testid="ssg-loader">{() => `post:${router.params.value.slug}`}</p>
    </>
  )
}
