import { Link } from "kiru/router"
import { setE2eAuth } from "../e2eAuth.js"

export default function ContextLoginPage() {
  return (
    <div data-testid="context-login">
      <p>Login (e2e)</p>
      <button
        type="button"
        data-testid="login-as-user"
        onclick={() => {
          setE2eAuth("user")
        }}
      >
        Log in as E2E User
      </button>
      <p>
        <Link to="/context">Back to context home</Link>
      </p>
    </div>
  )
}
