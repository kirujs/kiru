import { useRequestContext } from "kiru/router"

export default function ContextProfilePage() {
  const ctx = useRequestContext()
  const user = ctx.user
  return (
    <div data-testid="context-profile">
      <p data-testid="context-profile-body">profile-area</p>
      <p data-testid="context-user-label">
        {user ? `user:${user.name}` : "guest"}
      </p>
    </div>
  )
}
