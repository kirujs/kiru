import { useRouter } from "kiru/router"

export default function ThreadboardUserPage() {
  const router = useRouter()
  return () => (
    <div data-testid="threadboard-user-page" className="space-y-2">
      <h1 className="text-2xl font-bold">
        u/{() => router.params.value.username}
      </h1>
      <p className="text-slate-400">User profile stub for e2e tour.</p>
    </div>
  )
}
