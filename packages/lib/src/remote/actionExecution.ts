import type { CustomRequestContext } from "../router/types.js"

/** One nested action invocation; linked via `parent` (innermost = `currentFrame`). */
export type ActionExecutionFrame = {
  actionId: string
  parent?: ActionExecutionFrame
  startedAt: number
  endedAt?: number
  meta?: Record<string, unknown>
}

/** HTTP / transport identity for one RPC request (stable, request-scoped). */
export type RequestExecutionContext = {
  requestId: string
  request: Request
  response?: Response
  context: CustomRequestContext
  signal: AbortSignal
}

/** Mutable call-graph + per-request runtime services (nested frames, cache, tracing). */
export type ActionRuntimeContext = {
  rootFrame: ActionExecutionFrame
  currentFrame: ActionExecutionFrame
  cache: CacheScope
  tracing: TraceContext
  transaction?: Transaction
}

/** One request execution: transport layer + action runtime layer. */
export type ActionExecution = {
  request: RequestExecutionContext
  runtime: ActionRuntimeContext
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

export function createActionFrame(
  actionId: string,
  parent?: ActionExecutionFrame,
  meta?: Record<string, unknown>
): ActionExecutionFrame {
  return {
    actionId,
    parent,
    startedAt: Date.now(),
    meta,
  }
}

export type CreateActionExecutionOptions = {
  context: CustomRequestContext
  signal: AbortSignal
  request: Request
  requestId?: string
  response?: Response
  /** Sets both {@link ActionRuntimeContext.rootFrame} and `currentFrame`. */
  entryActionId: string
  cache?: CacheScope
  tracing?: TraceContext
  transaction?: Transaction
}

export function createActionExecution(
  options: CreateActionExecutionOptions
): ActionExecution {
  const requestId =
    options.requestId ??
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`)

  const rootFrame = createActionFrame(options.entryActionId)
  const tracing = options.tracing ?? createTraceContext()
  tracing.startSpan(options.entryActionId, { actionId: options.entryActionId })

  return {
    request: {
      requestId,
      request: options.request,
      response: options.response,
      context: options.context,
      signal: options.signal,
    },
    runtime: {
      rootFrame,
      currentFrame: rootFrame,
      cache: options.cache ?? createCacheScope(),
      tracing,
      transaction: options.transaction,
    },
  }
}

/** Walk from `currentFrame` to root (innermost first). */
export function listActionFrames(execution: ActionExecution): ActionExecutionFrame[] {
  const out: ActionExecutionFrame[] = []
  let cur: ActionExecutionFrame | undefined = execution.runtime.currentFrame
  while (cur) {
    out.push(cur)
    cur = cur.parent
  }
  return out
}
