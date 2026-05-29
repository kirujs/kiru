import { __DEV__, isServer } from "../env.js"
import type { TraceContext } from "./actionExecution.js"

declare const __KIRU_RPC_TRACE__: boolean | undefined

export type RpcTraceChannel =
  | "loader"
  | "action"
  | "readiness"
  | "page"
  | "prefetch"

export type RpcTraceEvent = {
  ts: number
  side: "client" | "server"
  channel: RpcTraceChannel
  phase: string
  traceId?: string
  requestId?: string
  rpcId?: string
  status?: number
  durationMs?: number
  error?: string
  meta?: Record<string, string | number | boolean>
}

const RING_LIMIT = 2000

type RpcTraceGlobal = {
  __kiruRpcTrace?: RpcTraceEvent[]
  __KIRU_RPC_TRACE__?: boolean
}

function readClientFlag(): boolean {
  try {
    return __KIRU_RPC_TRACE__ === true
  } catch {
    return false
  }
}

/** @internal When set, overrides env-based trace toggles (unit tests). */
let rpcTraceForced: boolean | undefined

export function isRpcTraceEnabled(): boolean {
  if (rpcTraceForced !== undefined) return rpcTraceForced
  if (typeof process !== "undefined" && process.env?.KIRU_RPC_TRACE === "1") {
    return true
  }
  if (typeof process !== "undefined" && process.env?.KIRU_E2E_DIAG === "1") {
    return true
  }
  const g = globalThis as RpcTraceGlobal
  if (g.__KIRU_RPC_TRACE__ === true) return true
  if (readClientFlag()) return true
  return false
}

function getBuffer(): RpcTraceEvent[] {
  const g = globalThis as RpcTraceGlobal
  return (g.__kiruRpcTrace ??= [])
}

function appendJsonl(event: RpcTraceEvent): void {
  const file =
    typeof process !== "undefined" ? process.env.KIRU_RPC_TRACE_FILE : undefined
  if (!isServer || !file) return
  // Runtime-only import — concatenated specifier avoids esbuild resolving node:fs in browser bundles.
  const fsSpecifier = "node:" + "fs"
  void import(/* @vite-ignore */ fsSpecifier).then(({ appendFileSync }) => {
    appendFileSync(file, `${JSON.stringify(event)}\n`, "utf8")
  })
}

export function rpcTrace(
  partial: Omit<RpcTraceEvent, "ts" | "side"> & {
    side?: RpcTraceEvent["side"]
    ts?: number
  }
): void {
  if (!isRpcTraceEnabled()) return
  const side: RpcTraceEvent["side"] =
    partial.side ??
    (typeof window !== "undefined" ? "client" : "server")
  const event: RpcTraceEvent = {
    ts: partial.ts ?? Date.now(),
    side,
    channel: partial.channel,
    phase: partial.phase,
    ...(partial.traceId !== undefined ? { traceId: partial.traceId } : {}),
    ...(partial.requestId !== undefined ? { requestId: partial.requestId } : {}),
    ...(partial.rpcId !== undefined ? { rpcId: partial.rpcId } : {}),
    ...(partial.status !== undefined ? { status: partial.status } : {}),
    ...(partial.durationMs !== undefined ? { durationMs: partial.durationMs } : {}),
    ...(partial.error !== undefined ? { error: partial.error } : {}),
    ...(partial.meta !== undefined ? { meta: partial.meta } : {}),
  }
  const buf = getBuffer()
  buf.push(event)
  if (buf.length > RING_LIMIT) buf.splice(0, buf.length - RING_LIMIT)
  appendJsonl(event)
  if (__DEV__) {
    const parts = [
      event.channel,
      event.phase,
      event.rpcId,
      event.traceId,
      event.durationMs !== undefined ? `${event.durationMs}ms` : undefined,
      event.status,
      event.error,
    ].filter(Boolean)
    console.log(`[kiru-rpc] ${parts.join(" ")}`)
  }
}

export function newRpcTraceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function dumpRpcTrace(): RpcTraceEvent[] {
  return [...getBuffer()]
}

export function flushRpcTraceSpans(tracing: TraceContext | undefined): void {
  if (!tracing || !isRpcTraceEnabled()) return
  for (const span of tracing.spans) {
    rpcTrace({
      channel: "action",
      phase: `span:${span.name}`,
      traceId: tracing.traceId,
      rpcId: span.actionId,
      durationMs:
        span.end !== undefined ? span.end - span.start : Date.now() - span.start,
      meta: span.meta as Record<string, string | number | boolean> | undefined,
    })
  }
}

export function bridgeTraceReadiness(
  kind: "resource" | "scheduler" | "form" | "binding",
  detail: Record<string, string | number | boolean | undefined>
): void {
  if (!isRpcTraceEnabled()) return
  const meta: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(detail)) {
    if (v !== undefined) meta[k] = v
  }
  rpcTrace({
    channel: "readiness",
    phase: kind,
    meta,
  })
}

export function rpcTraceResponseHeaders(traceId: string): Record<string, string> {
  if (!isRpcTraceEnabled()) return {}
  return { "x-kiru-trace-id": traceId }
}

/** Partial fields merged into a trace event (channel/phase supplied by caller). */
export type RpcTraceExtra = Partial<
  Omit<RpcTraceEvent, "ts" | "side" | "channel" | "phase">
>

/** @internal Tests only */
export function __clearRpcTraceForTests(): void {
  const g = globalThis as RpcTraceGlobal
  g.__kiruRpcTrace = []
}

/** @internal Tests only */
export function __setRpcTraceEnabledForTests(enabled: boolean): void {
  rpcTraceForced = enabled
  const prev = process.env.KIRU_RPC_TRACE
  if (enabled) process.env.KIRU_RPC_TRACE = "1"
  else delete process.env.KIRU_RPC_TRACE
  ;(globalThis as RpcTraceGlobal).__KIRU_RPC_TRACE__ = enabled
  if (!enabled) {
    __clearRpcTraceForTests()
    if (prev === undefined) delete process.env.KIRU_RPC_TRACE
    else process.env.KIRU_RPC_TRACE = prev
    rpcTraceForced = false
  }
}
