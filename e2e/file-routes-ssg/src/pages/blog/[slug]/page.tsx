import { useRouter } from "kiru/router"

export async function generateStaticParams() {
  return [{ slug: "hello" }, { slug: "hello world" }]
}

export default function BlogPost() {
  const router = useRouter()
  return () => (
    <h2 data-testid="fbr-blog">Post: {() => router.params.value.slug}</h2>
  )
}
