import {
  bindClientDisconnectAbort,
  createKiruResponder,
  nodeRequestToFetch,
  writeNodeResponse,
} from "@kirujs/adapter-node"
import express from "express"
import { routes } from "../fixture/routes"

const isProd = process.env.NODE_ENV === "production"

const kiru = createKiruResponder({
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

if (isProd && !("Bun" in globalThis)) {
  const port = Number(process.env.PORT) || 3000
  app.listen(port, () => {
    console.log(`[e2e-ssr-matrix] express listening on http://localhost:${port}`)
  })
}
