import { createKiruResponder, serveKiruNode } from "@kirujs/adapter-node"
import { toWebResponse } from "@kirujs/adapter-contract"
import { Elysia } from "elysia"
import { routes } from "../fixture/routes"

const isProd = process.env.NODE_ENV === "production"

const kiru = createKiruResponder({
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
    return toWebResponse(out)
  })

export default { fetch: app.fetch }

if (isProd && !("Bun" in globalThis)) {
  const port = Number(process.env.PORT) || 3000
  serveKiruNode({ fetch: app.fetch }, port)
}
