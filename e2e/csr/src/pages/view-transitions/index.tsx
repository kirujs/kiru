import { useRouter } from "kiru/router"

export default function ViewTransitionsPage() {
  const router = useRouter()
  return () => (
    <div>
      <h2 data-testid="vt-page">View transitions</h2>
      <button
        type="button"
        data-testid="vt-nav-about"
        onclick={() => void router.navigate("/about", { transition: true })}
      >
        About with transition
      </button>
    </div>
  )
}
