import { createNavGuard, GuardBeforeEach } from "kiru/router"
import { userId } from "../state/user"

const redirectFromProtected: GuardBeforeEach = (_, to) => {
  if (to === "/protected" && userId.value === null) {
    return "/login"
  }
}

const redirectFromLogin: GuardBeforeEach = (_, to) => {
  if (to === "/login" && userId.value !== null) {
    return "/"
  }
}

export const guard = createNavGuard()
  .beforeEach(redirectFromProtected, redirectFromLogin)
  .afterEach((_, to, from) => console.log("afterEach", to, from))
