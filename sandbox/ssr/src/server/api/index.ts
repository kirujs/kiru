import { Hono } from "hono"
import auth, { authCookieParserMiddleware } from "./routers/auth"
import products from "./routers/products"
import admin from "./routers/admin"

export { authCookieParserMiddleware }
export default new Hono()
  .route("/admin", admin)
  .route("/auth", auth)
  .route("/products", products)
