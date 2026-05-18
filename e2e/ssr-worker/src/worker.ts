import {
  createKiruWorkerHandler,
  assetsBindingToGetAsset,
  type KiruWorkerHandler,
} from "@kirujs/adapter-cloudflare"
import { routes } from "./routes"

export interface Env {
  ASSETS: { fetch: typeof fetch }
}

let handler: KiruWorkerHandler | null = null

async function getHandler(env: Env): Promise<KiruWorkerHandler> {
  if (handler) return handler
  const tplRes = await env.ASSETS.fetch(
    new Request("https://assets.local/index.html")
  )
  const htmlTemplate = await tplRes.text()
  const assetFetch = (req: Request) => env.ASSETS.fetch(req)
  handler = createKiruWorkerHandler({
    routes,
    htmlTemplate,
    stream: false,
    getAsset: assetsBindingToGetAsset(assetFetch),
    assetFetch,
  })
  return handler
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const h = await getHandler(env)
    return h(request, env, ctx)
  },
}
