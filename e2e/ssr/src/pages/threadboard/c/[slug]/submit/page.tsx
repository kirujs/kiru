import { Link, useRouter } from "kiru/router"

export default function ThreadboardSubmitPage() {
  const router = useRouter()
  return () => {
    const slug = router.params.value.slug
    return (
      <div data-testid="threadboard-submit" className="space-y-4">
        <h1 className="text-2xl font-bold">Create post in c/{slug}</h1>
        <p className="text-slate-400">
          Submit form stub for e2e navigation tour.
        </p>
        <Link to="/threadboard/c/[slug]" params={{ slug }}>
          Back to community
        </Link>
      </div>
    )
  }
}
