import { useRequestContext } from "kiru/router"

export default function ContextHomePage() {
  const ctx = useRequestContext()
  const user = ctx.user
  return (
    <div data-testid="context-home">
      <p data-testid="context-user-label">
        {user ? `user:${user.name}` : "guest"}
      </p>
    </div>
  )
}
