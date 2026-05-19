import {
  createKiruWorkerHandle,
  assetsBindingToGetAsset,
} from "@kirujs/adapter-cloudflare"
import type { KiruHandle } from "@kirujs/adapter-contract"
import { Hono } from "hono"
import { routes } from "../fixture/routes"

export interface Env {
  ASSETS: { fetch: typeof fetch }
}

let kiruHandle: KiruHandle | null = null

async function getKiruHandle(env: Env): Promise<KiruHandle> {
  if (kiruHandle) return kiruHandle
  const tplRes = await env.ASSETS.fetch(
    new Request("https://assets.local/index.html")
  )
  const htmlTemplate = await tplRes.text()
  const assetFetch = (req: Request) => env.ASSETS.fetch(req)
  kiruHandle = createKiruWorkerHandle({
    routes,
    htmlTemplate,
    stream: false,
    getAsset: assetsBindingToGetAsset(assetFetch),
    assetFetch,
  })
  return kiruHandle
}

const app = new Hono<{ Bindings: Env }>()
app.get("/api/health", (c) => c.json({ ok: true }))
app.all("*", async (c) => {
  const handle = await getKiruHandle(c.env)
  const out = await handle(c.req.raw)
  if (out === null) return c.notFound()
  return out
})

export default {
  fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Response | Promise<Response> {
    return app.fetch(request, env, ctx)
  },
}
