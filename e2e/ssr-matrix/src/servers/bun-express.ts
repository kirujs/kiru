import {
  createKiruBunServer,
  nodeRequestToFetch,
  sendKiruResponse,
} from "@kirujs/adapter-bun"
import express from "express"
import { routes } from "../fixture/routes"

const isProd = process.env.NODE_ENV === "production"

const kiru = createKiruBunServer({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: false,
  routes,
})

const app = express()
app.get("/api/health", (_req, res) => res.json({ ok: true }))
app.use(async (req, res) => {
  const out = await kiru.handle(nodeRequestToFetch(req))
  if (out === null) {
    res.status(404).send("Not Found")
    return
  }
  await sendKiruResponse(res, out)
})

if (isProd) {
  const port = Number(process.env.PORT) || 3000
  app.listen(port, () => {
    console.log(`[e2e-ssr-matrix] express (bun) listening on http://localhost:${port}`)
  })
}
