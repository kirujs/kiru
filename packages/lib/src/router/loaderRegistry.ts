import {
  newRpcTraceId,
  rpcTrace,
  rpcTraceResponseHeaders,
  type RpcTraceExtra,
} from "../remote/rpcTrace.js"
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
  hasLazyImport(routeId: string): boolean {
    return routeId in lazyImports
  },
  getRegisteredLoaderNames(routeId: string): string[] {
    return Object.keys(registry[routeId] ?? {})
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

    const traceId =
      request.headers.get("x-kiru-trace-parent") ?? newRpcTraceId()
    const trace = (phase: string, extra?: RpcTraceExtra): void => {
      rpcTrace({
        side: "server",
        channel: "loader",
        phase,
        traceId,
        rpcId: loaderId,
        ...extra,
      })
    }

    trace("request_received")

    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
      trace("rejected_content_type")
      return null
    }

    const token = request.headers.get("x-kiru-token")
    if (!token) {
      trace("token_missing", { status: 400 })
      return new Response(null, { status: 400 })
    }

    const split = loaderId.indexOf(":")
    if (split < 1) {
      trace("handler_missing", { status: 500 })
      return new Response(null, { status: 500 })
    }
    const routeId = loaderId.slice(0, split)
    const loaderName = loaderId.slice(split + 1)

    const allowed = options?.allowedOrigins
    if (allowed && allowed.length > 0 && !isAllowedOrigin(request, allowed)) {
      trace("origin_denied", { status: 403 })
      return new Response(null, { status: 403 })
    }

    const context = unwrapKiruToken(token, secret)
    if (!context) {
      trace("token_invalid", { status: 400 })
      return new Response(null, { status: 400 })
    }

    trace("registry_ensure_start")
    await __INTERNAL_LOADER_REGISTRY.ensure(routeId)
    trace("registry_ensure_end")

    const handler = registry[routeId]?.[loaderName]
    if (!isKiruLoader(handler) || handler.__kiruLoader !== "server") {
      const hadLazyImport = __INTERNAL_LOADER_REGISTRY.hasLazyImport(routeId)
      const registeredLoaderNames =
        __INTERNAL_LOADER_REGISTRY.getRegisteredLoaderNames(routeId).join(",")
      trace("handler_missing", {
        status: 500,
        meta: {
          hadLazyImport,
          registeredLoaderNames,
          loaderName,
        },
      })
      return new Response(null, { status: 500 })
    }

    let body: unknown
    try {
      trace("body_parse")
      body = await request.json()
    } catch {
      trace("body_parse", { status: 400, error: "invalid_json" })
      return new Response(null, { status: 400 })
    }

    const loaderCtx = body as LoaderContext
    loaderCtx.context = context
    loaderCtx.request = request
    loaderCtx.signal = request.signal

    const invokeStart = Date.now()
    trace("invoke_start")
    try {
      const data = await handler.__kiruInvoke(loaderCtx)
      const payload = JSON.stringify(data)
      trace("invoke_end", {
        durationMs: Date.now() - invokeStart,
        meta: { payloadBytes: payload.length },
      })
      trace("response", { status: 200 })
      return new Response(payload, {
        status: 200,
        headers: {
          ...jsonHeaders,
          ...rpcTraceResponseHeaders(traceId),
        },
      })
    } catch (err) {
      trace("invoke_error", {
        durationMs: Date.now() - invokeStart,
        status: 500,
        error: err instanceof Error ? err.message : String(err),
      })
      trace("response", { status: 500 })
      return new Response(null, {
        status: 500,
        headers: rpcTraceResponseHeaders(traceId),
      })
    }
  }
}
