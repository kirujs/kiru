import { isBrowser } from "./env.js"
import { dumpHydrationTrace, type HydrationTraceEntry } from "./hydration.js"
import { dumpRpcTrace, type RpcTraceEvent } from "./remote/rpcTrace.js"
import { isRpcTraceEnabled } from "./remote/rpcTrace.js"
import {
  snapshotLoaderCache,
  type LoaderCacheSnapshotEntry,
} from "./router/loaderCache.js"

export type { HydrationTraceEntry }

export type KiruDiagnosticsDump = {
  rpcTrace: RpcTraceEvent[]
  hydrationTrace?: HydrationTraceEntry[]
  hydrationErrors?: string[]
  loaderCacheSnapshot?: LoaderCacheSnapshotEntry[]
  hydratedAt?: number
}

export function dumpKiruDiagnostics(): KiruDiagnosticsDump {
  const out: KiruDiagnosticsDump = {
    rpcTrace: dumpRpcTrace(),
  }
  if (isBrowser) {
    const { trace, errors } = dumpHydrationTrace()
    if (trace.length) out.hydrationTrace = trace
    if (errors.length) out.hydrationErrors = errors
    const hydratedAt = (
      window as typeof window & { __kiruHydratedAt?: number }
    ).__kiruHydratedAt
    if (hydratedAt !== undefined) out.hydratedAt = hydratedAt
  }
  if (isRpcTraceEnabled()) {
    const snap = snapshotLoaderCache(32)
    if (snap.length) out.loaderCacheSnapshot = snap
  }
  return out
}
