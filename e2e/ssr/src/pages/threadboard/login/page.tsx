import { Link } from "kiru/router"

/** Full-page fallback when the login interceptor is not active. */
export default function ThreadboardLoginPage() {
  return (
    <div data-testid="threadboard-login-page">
      <h1>Sign in</h1>
      <p>
        <Link to="/threadboard">Back to threadboard</Link>
      </p>
    </div>
  )
}
