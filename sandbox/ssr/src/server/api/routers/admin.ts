import { Hono } from "hono"
import { authCookieParserMiddleware } from "./auth"
import { AdminService } from "../services/admin"

export default new Hono().get("/", authCookieParserMiddleware, async (c) => {
  const user = c.get("user")
  if (user === null) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  return c.json(await AdminService.getData())
})
