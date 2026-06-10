import { Link, useRouter } from "kiru/router"

/** Full-page fallback when the post interceptor is not active. */
export default function ThreadboardPostPage() {
  const router = useRouter()
  return () => (
    <div data-testid="threadboard-post-page">
      <h1>Post {() => router.params.value.id}</h1>
      <p>
        <Link to="/threadboard">Back to threadboard</Link>
      </p>
    </div>
  )
}
