import { createNavGuard } from "kiru/router"
import { userId } from "../state/user.js"

export const guard = createNavGuard().beforeEach((_, to) => {
  console.log("beforeEach", to)
  if (to === "/protected" && userId.value === null) {
    return "/login"
  }
  if (to === "/login" && userId.value !== null) {
    return "/"
  }
})
