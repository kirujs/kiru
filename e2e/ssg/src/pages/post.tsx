import { useRouter } from "kiru/router"

export default function PostPage({ slug }: { slug?: string }) {
  const router = useRouter() as any
  const value = slug ?? router.params.value.slug ?? "unknown"
  return <p data-testid="ssg-post">SSG post: {value}</p>
}
