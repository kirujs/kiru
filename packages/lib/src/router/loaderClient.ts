import { requestToken } from "../globals.js"
import {
  isRpcTraceEnabled,
  newRpcTraceId,
  rpcTrace,
} from "../remote/rpcTrace.js"
import type { LoaderContext } from "./loaders.js"

export type LoaderDispatch = (
  routeId: string,
  ctx: LoaderContext
) => Promise<unknown>

export function isLoaderRpcAvailable(): boolean {
  return !!(globalThis as Record<string, unknown>).__kiru_loaders
}

const inFlightLoaderRpc = new Map<string, Promise<unknown>>()

function loaderRpcKey(routeId: string, ctx: LoaderContext): string {
  return `${routeId}:${ctx.url.pathname}:${ctx.url.search}`
}

async function dispatchLoaderRpc(
  routeId: string,
  context: LoaderContext
): Promise<unknown> {
  const rpcId = `${routeId}:load`
  const traceId = newRpcTraceId()
  const start = Date.now()
  rpcTrace({
    channel: "loader",
    phase: "fetch_start",
    traceId,
    rpcId,
    meta: { hasToken: !!requestToken.current },
  })
  const r = await fetch(`/?loader=${encodeURIComponent(rpcId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-kiru-token": requestToken.current,
      "x-kiru-trace-parent": traceId,
    },
    body: JSON.stringify(context),
    signal: context.signal,
  })
  const responseTraceId = r.headers.get("x-kiru-trace-id") ?? traceId
  rpcTrace({
    channel: "loader",
    phase: "fetch_done",
    traceId: responseTraceId,
    rpcId,
    status: r.status,
    durationMs: Date.now() - start,
  })
  if (!r.ok) {
    rpcTrace({
      channel: "loader",
      phase: "fetch_error",
      traceId: responseTraceId,
      rpcId,
      status: r.status,
      error: "Loader request failed",
    })
    throw new Error("Loader request failed")
  }
  try {
    const data = await r.json()
    rpcTrace({
      channel: "loader",
      phase: "json_parse",
      traceId: responseTraceId,
      rpcId,
    })
    return data
  } catch (err) {
    rpcTrace({
      channel: "loader",
      phase: "json_parse",
      traceId: responseTraceId,
      rpcId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/** @internal Tests only */
export function __clearLoaderRpcFlightsForTests(): void {
  inFlightLoaderRpc.clear()
}

function attachDiagnosticsGlobals(): void {
  if (typeof window === "undefined" || !isRpcTraceEnabled()) return
  const w = window as typeof window & {
    dumpKiruDiagnostics?: () => import("../diagnostics.js").KiruDiagnosticsDump
    __kiruDumpRpcTrace?: () => import("../remote/rpcTrace.js").RpcTraceEvent[]
  }
  if (!w.dumpKiruDiagnostics) {
    void import("../diagnostics.js").then((m) => {
      w.dumpKiruDiagnostics = () => m.dumpKiruDiagnostics()
      w.__kiruDumpRpcTrace = () => m.dumpKiruDiagnostics().rpcTrace
    })
  }
}

export function ensureLoaderClient(): void {
  if (typeof window === "undefined") return
  const g = globalThis as typeof globalThis & {
    __kiru_loaders?: { dispatch: LoaderDispatch }
  }
  if (g.__kiru_loaders) return
  attachDiagnosticsGlobals()
  g.__kiru_loaders = {
    dispatch: async (routeId, context) => {
      const key = loaderRpcKey(routeId, context)
      const inFlight = inFlightLoaderRpc.get(key)
      if (inFlight) {
        rpcTrace({
          channel: "loader",
          phase: "fetch_dedupe",
          rpcId: `${routeId}:load`,
          meta: { pathname: context.url.pathname },
        })
        return inFlight
      }
      const flight = dispatchLoaderRpc(routeId, context)
      inFlightLoaderRpc.set(key, flight)
      try {
        return await flight
      } finally {
        if (inFlightLoaderRpc.get(key) === flight) {
          inFlightLoaderRpc.delete(key)
        }
      }
    },
  }
}

export function getLoaderDispatch(): LoaderDispatch {
  ensureLoaderClient()
  return (
    globalThis as typeof globalThis & {
      __kiru_loaders?: { dispatch: LoaderDispatch }
    }
  ).__kiru_loaders!.dispatch
}

/** @internal Used by vite codegen for `serverLoader` client bundles. */
export function __kiruEnsureLoaderDispatch(): LoaderDispatch {
  return getLoaderDispatch()
}
