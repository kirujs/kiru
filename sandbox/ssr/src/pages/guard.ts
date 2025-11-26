import { createNavGuard } from "kiru/router"

export const guard = createNavGuard().beforeEach(({ user }, to) => {
  if (to === "/protected" && user === null) {
    return `/login?redirect=${encodeURIComponent(to)}`
  }

  if (to === "/login" && user !== null) {
    return "/"
  }
})
