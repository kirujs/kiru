import { unwrapKiruToken } from "../remote/token.js"
import type { LoaderContext } from "./loaders.js"
import { isKiruLoader, type KiruLoader } from "./loaders.js"

const registry: Record<string, Record<string, KiruLoader>> = {}
const lazyImports: Record<string, () => Promise<unknown>> = {}

export const __INTERNAL_LOADER_REGISTRY = {
  register(id: string, loaders: Record<string, KiruLoader>): void {
    registry[id] = loaders
  },
  registerLazyImport(
    routeId: string,
    load: () => Promise<unknown>
  ): void {
    lazyImports[routeId] = load
  },
  async ensure(routeId: string): Promise<void> {
    if (registry[routeId]) return
    const load = lazyImports[routeId]
    if (load) await load()
  },
}

export type CreateLoaderHandlerOptions = {
  allowedOrigins?: string[]
}

function isAllowedOrigin(
  request: Request,
  allowed: readonly string[]
): boolean {
  if (allowed.length === 0) return true
  if (allowed.includes("*")) return true
  const origin = request.headers.get("origin") ?? ""
  if (origin && allowed.includes(origin)) return true
  const referer = request.headers.get("referer")
  if (!referer) return false
  try {
    const u = new URL(referer)
    return allowed.includes(`${u.protocol}//${u.host}`)
  } catch {
    return false
  }
}

export function createLoaderHandler(
  secret: string,
  options?: CreateLoaderHandlerOptions
): (request: Request) => Promise<Response | null> {
  const jsonHeaders = {
    "content-type": "application/json; charset=utf-8",
  } as const

  return async (request: Request) => {
    if (request.method !== "POST") return null
    const url = new URL(request.url)
    const loaderId = url.searchParams.get("loader")
    if (!loaderId) return null

    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) return null

    const token = request.headers.get("x-kiru-token")
    if (!token) return new Response(null, { status: 400 })

    const split = loaderId.indexOf(":")
    if (split < 1) return new Response(null, { status: 500 })
    const routeId = loaderId.slice(0, split)
    const loaderName = loaderId.slice(split + 1)

    const allowed = options?.allowedOrigins
    if (allowed && allowed.length > 0 && !isAllowedOrigin(request, allowed)) {
      return new Response(null, { status: 403 })
    }

    const context = unwrapKiruToken(token, secret)
    if (!context) return new Response(null, { status: 400 })

    await __INTERNAL_LOADER_REGISTRY.ensure(routeId)

    const handler = registry[routeId]?.[loaderName]
    if (!isKiruLoader(handler) || handler.__kiruLoader !== "server") {
      return new Response(null, { status: 500 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response(null, { status: 400 })
    }

    const loaderCtx = body as LoaderContext
    loaderCtx.context = context
    loaderCtx.request = request

    try {
      const data = await handler.__kiruInvoke(loaderCtx)
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: jsonHeaders,
      })
    } catch {
      return new Response(null, { status: 500 })
    }
  }
}
