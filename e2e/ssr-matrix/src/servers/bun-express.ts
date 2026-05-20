import {
  bindClientDisconnectAbort,
  createKiruBunServer,
  nodeRequestToFetch,
  writeNodeResponse,
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
  const { request, abort } = nodeRequestToFetch(req)
  const unbind = bindClientDisconnectAbort(res, abort)
  try {
    const out = await kiru.handle(request)
    if (out === null) {
      res.status(404).send("Not Found")
      return
    }
    await writeNodeResponse(res, out, abort.signal)
  } finally {
    unbind()
  }
})

if (isProd) {
  const port = Number(process.env.PORT) || 3000
  app.listen(port, () => {
    console.log(`[e2e-ssr-matrix] express (bun) listening on http://localhost:${port}`)
  })
}
