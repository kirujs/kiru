import { userId } from "../../state/user"
import { useFileRouter } from "kiru/router"

export default function LoginPage() {
  const router = useFileRouter()
  return (
    <div>
      <h1>Login Page</h1>
      <button onclick={() => ((userId.value = 1), router.navigate("/"))}>
        Login
      </button>
    </div>
  )
}
