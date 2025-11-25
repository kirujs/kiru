import { Hono } from "hono"
import auth, { authCookieParserMiddleware } from "./routers/auth"
import products from "./routers/products"

export { authCookieParserMiddleware }
export default new Hono().route("/auth", auth).route("/products", products)
