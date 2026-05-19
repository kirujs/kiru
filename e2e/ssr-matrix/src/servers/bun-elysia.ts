import { createKiruBunServer } from "@kirujs/adapter-bun"
import { Elysia } from "elysia"
import { routes } from "../fixture/routes"

const isProd = process.env.NODE_ENV === "production"

const kiru = createKiruBunServer({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: false,
  routes,
})

const app = new Elysia()
  .get("/api/health", () => ({ ok: true }))
  .all("*", async ({ request }) => {
    const out = await kiru.handle(request)
    if (out === null) return new Response("Not Found", { status: 404 })
    return out
  })
  .compile()

export default { fetch: app.handle }
