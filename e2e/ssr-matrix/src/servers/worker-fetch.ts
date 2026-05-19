import {
  createKiruWorkerHandle,
  assetsBindingToGetAsset,
} from "@kirujs/adapter-cloudflare"
import type { KiruHandle } from "@kirujs/adapter-contract"
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

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true })
    }
    const handle = await getKiruHandle(env)
    const out = await handle(request)
    if (out === null) {
      return new Response("Not Found", { status: 404 })
    }
    return out
  },
}
