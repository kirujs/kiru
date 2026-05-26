import { useRouter } from "kiru/router"

export default function BlogPost() {
  const router = useRouter()
  return () => (
    <h2 data-testid="fbr-blog">Post: {() => router.params().slug}</h2>
  )
}
