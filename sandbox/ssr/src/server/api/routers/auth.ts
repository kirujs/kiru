import { Hono } from "hono"
import { setCookie, deleteCookie, getCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"
import * as z from "zod"
import { zValidator } from "@hono/zod-validator"
import UserService, { type User } from "../../services/user"

const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
})

export default new Hono()
  .post("/login", zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json")
    const user = await UserService.login(email, password)
    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401)
    }

    setCookie(c, "user", JSON.stringify(user))
    return c.redirect("/")
  })
  .get("/logout", async (c) => {
    deleteCookie(c, "user")
    return c.redirect("/")
  })

export const authCookieParserMiddleware = createMiddleware<{
  Variables: { user: User | null }
}>(async (c, next) => {
  let user: User | null
  try {
    user = JSON.parse(getCookie(c, "user")!)
  } catch {
    user = null
  }

  c.set("user", user)
  await next()
})
