import { createKiruResponder, serveKiruNode } from "@kirujs/adapter-node"
import { toWebResponse } from "@kirujs/adapter-contract"
import { Hono } from "hono"
import { routes } from "../fixture/routes"

const isProd = process.env.NODE_ENV === "production"

const kiru = createKiruResponder({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: false,
  routes,
})

const app = new Hono()
app.get("/api/health", (c) => c.json({ ok: true }))
app.all("*", async (c) => {
  const out = await kiru.handle(c.req.raw)
  if (out === null) return c.notFound()
  return toWebResponse(out)
})

export default { fetch: app.fetch }

if (isProd && !("Bun" in globalThis)) {
  const port = Number(process.env.PORT) || 3000
  serveKiruNode({ fetch: app.fetch.bind(app) }, port)
}
