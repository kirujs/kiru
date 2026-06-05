import type { CustomRequestContext } from "../router/types.js"

/** One nested action invocation; linked via `parent` (innermost = `currentFrame`). */
export type RemoteExecutionFrame = {
  actionId: string
  parent?: RemoteExecutionFrame
  startedAt: number
  endedAt?: number
  meta?: Record<string, unknown>
}

/** Transport input for one action RPC (ALS request layer). */
export type RequestEnvelope = {
  body?: unknown
  query?: Record<string, unknown>
  headers: Headers
  context: CustomRequestContext
  requestId: string
  signal: AbortSignal
  raw: Request
}

export type MiddlewareState = {
  locals: Record<string, unknown>
}

/** Per-request runtime services (cache, tracing, middleware bag). */
export type RuntimeContext = {
  cache: CacheScope
  tracing: TraceContext
  transaction?: Transaction
  middleware: MiddlewareState
}

/** Call-graph frames (ALS execution layer). */
export type ExecutionState = {
  rootFrame: RemoteExecutionFrame
  currentFrame: RemoteExecutionFrame
}

/** ALS store shape only — not passed to handlers/middleware. */
export type RemoteExecution = {
  request: RequestEnvelope
  runtime: RuntimeContext
  execution: ExecutionState
}

/** Lowercase header names; first value wins when duplicated. */
export function headersToValidationInput(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (out[k] === undefined) out[k] = value
  })
  return out
}

/** Request-local memoization (in-flight dedupe, not CDN/global). */
export type CacheScope = {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  memo<T>(key: string, fn: () => T | Promise<T>): Promise<T>
}

export type TraceSpan = {
  name: string
  actionId?: string
  start: number
  end?: number
  meta?: Record<string, unknown>
}

/** Per-request observability; frame stack drives nested spans. */
export type TraceContext = {
  traceId: string
  spans: TraceSpan[]
  startSpan(name: string, meta?: { actionId?: string }): TraceSpan
  endSpan(span: TraceSpan): void
}

/**
 * Shared DB transaction scope (optional).
 * One transaction per request, inherited by all frames (Option A).
 */
export type Transaction = {
  commit(): Promise<void>
  rollback(): Promise<void>
}

export function createCacheScope(): CacheScope {
  const values = new Map<string, unknown>()
  const pending = new Map<string, Promise<unknown>>()

  return {
    get<T>(key: string): T | undefined {
      return values.get(key) as T | undefined
    },
    set<T>(key: string, value: T): void {
      values.set(key, value)
    },
    memo<T>(key: string, fn: () => T | Promise<T>): Promise<T> {
      const hit = values.get(key)
      if (hit !== undefined) return Promise.resolve(hit as T)
      const inflight = pending.get(key)
      if (inflight) return inflight as Promise<T>
      const p = Promise.resolve(fn()).then((v) => {
        values.set(key, v)
        pending.delete(key)
        return v as T
      })
      pending.set(key, p)
      return p
    },
  }
}

export function createTraceContext(traceId?: string): TraceContext {
  const id =
    traceId ??
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `trace_${Date.now()}_${Math.random().toString(36).slice(2)}`)
  const spans: TraceSpan[] = []

  return {
    traceId: id,
    spans,
    startSpan(name, meta) {
      const span: TraceSpan = {
        name,
        actionId: meta?.actionId,
        start: Date.now(),
      }
      spans.push(span)
      return span
    },
    endSpan(span) {
      span.end = Date.now()
    },
  }
}

export function createRemoteFrame(
  actionId: string,
  parent?: RemoteExecutionFrame,
  meta?: Record<string, unknown>
): RemoteExecutionFrame {
  return {
    actionId,
    parent,
    startedAt: Date.now(),
    meta,
  }
}

export type CreateRemoteExecutionOptions = {
  context: CustomRequestContext
  signal: AbortSignal
  request: Request
  headers: Headers
  body?: unknown
  query?: Record<string, unknown>
  requestId?: string
  /** Sets both {@link ExecutionState.rootFrame} and `currentFrame`. */
  entryActionId: string
  cache?: CacheScope
  tracing?: TraceContext
  transaction?: Transaction
}

export function createRemoteExecution(
  options: CreateRemoteExecutionOptions
): RemoteExecution {
  const requestId =
    options.requestId ??
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`)

  const rootFrame = createRemoteFrame(options.entryActionId)
  const tracing = options.tracing ?? createTraceContext()
  tracing.startSpan(options.entryActionId, { actionId: options.entryActionId })

  return {
    request: {
      body: options.body,
      query: options.query,
      headers: options.headers,
      context: options.context,
      requestId,
      signal: options.signal,
      raw: options.request,
    },
    runtime: {
      cache: options.cache ?? createCacheScope(),
      tracing,
      transaction: options.transaction,
      middleware: { locals: {} },
    },
    execution: {
      rootFrame,
      currentFrame: rootFrame,
    },
  }
}

/** Walk from `currentFrame` to root (innermost first). */
export function listRemoteFrames(execution: RemoteExecution): RemoteExecutionFrame[] {
  const out: RemoteExecutionFrame[] = []
  let cur: RemoteExecutionFrame | undefined = execution.execution.currentFrame
  while (cur) {
    out.push(cur)
    cur = cur.parent
  }
  return out
}
