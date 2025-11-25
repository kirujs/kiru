import { createNavGuard } from "kiru/router"

export const guard = createNavGuard().beforeEach((path, context) => {
  const { user } = context

  if (path === "/protected" && user === null) {
    return `/login?redirect=${encodeURIComponent(path)}`
  }

  if (path === "/login" && user !== null) {
    return "/"
  }
})
