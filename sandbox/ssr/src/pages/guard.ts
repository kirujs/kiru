import { createNavGuard, GuardBeforeEach } from "kiru/router"

const protectProtectedPage: GuardBeforeEach = function (context, to) {
  if (to === "/protected" && context.user === null) {
    return `/login?redirect=${encodeURIComponent(to)}`
  }
}

export const guard = createNavGuard().beforeEach(
  protectProtectedPage,
  async (context, to) => {
    if (to === "/login" && context.user !== null) {
      return "/"
    }
  }
)
