import { Link, useRouter } from "kiru/router"
import { LoginForm } from "../auth/login-form.js"

export default function LoginPage() {
  const router = useRouter()

  return () => (
    <div className="mx-auto max-w-md space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Sign in to Threadboard</h2>
      <p className="text-sm text-slate-400">
        Full-page sign in. On success you are redirected home.
      </p>

      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <LoginForm
          onSuccess={() => {
            void router.navigate("/")
          }}
        />
      </div>

      <p className="text-sm text-slate-400">
        <Link to="/" className="text-cyan-300 hover:underline">
          ← Back home
        </Link>
      </p>
    </div>
  )
}
