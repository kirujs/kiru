import { createKiruResponder } from "@kirujs/adapter-node"
import { node } from "@elysiajs/node"
import { Elysia } from "elysia"
import { routes } from "../fixture/routes"

const isProd = process.env.NODE_ENV === "production"

const kiru = createKiruResponder({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: false,
  routes,
})

const app = new Elysia({ adapter: node() })
  .get("/api/health", () => ({ ok: true }))
  .all("*", async ({ request }) => {
    const out = await kiru.handle(request)
    if (out === null) return new Response("Not Found", { status: 404 })
    return out
  })
  .compile()

export default { fetch: app.handle }

if (isProd && !("Bun" in globalThis)) {
  const port = Number(process.env.PORT) || 3000
  app.listen(port)
}
