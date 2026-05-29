import {
  createKiruWorkerHandle,
  assetsBindingToGetAsset,
} from "@kirujs/adapter-cloudflare"
import type { KiruHandle } from "@kirujs/adapter-contract"
import { Elysia } from "elysia"
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker"
import { routes } from "../fixture/routes"

export interface Env {
  ASSETS: { fetch: typeof fetch }
}

let kiruHandle: KiruHandle | null = null
/** Set on each incoming request before Elysia handles it. */
let workerEnv: Env | null = null

async function getKiruHandle(): Promise<KiruHandle> {
  if (kiruHandle) return kiruHandle
  if (!workerEnv) {
    throw new Error("Worker env not initialized")
  }
  const tplRes = await workerEnv.ASSETS.fetch(
    new Request("https://assets.local/index.html")
  )
  const htmlTemplate = await tplRes.text()
  const assetFetch = (req: Request) => workerEnv!.ASSETS.fetch(req)
  kiruHandle = createKiruWorkerHandle({
    routes,
    htmlTemplate,
    stream: false,
    getAsset: assetsBindingToGetAsset(assetFetch),
    assetFetch,
  })
  return kiruHandle
}

const app = new Elysia({ adapter: CloudflareAdapter, aot: false })
  .get("/api/health", () => ({ ok: true }))
  .all("*", async ({ request }) => {
    const handle = await getKiruHandle()
    const out = await handle(request)
    if (out === null) return new Response("Not Found", { status: 404 })
    return out
  })

export default {
  fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Response | Promise<Response> {
    workerEnv = env
    return app.fetch(request)
  },
}
