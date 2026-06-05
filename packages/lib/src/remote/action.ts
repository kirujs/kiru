import type { CustomRequestContext } from "../router/types.js"
import { serializeValidatedQuery } from "../router/searchParams.js"
import type { RemoteExecution } from "./remoteExecution.js"
import { RemoteCookies } from "./remoteCookies.js"
import {
  getSsrRemoteScopeEntry,
  runWithSsrRemoteContext,
} from "./ssrRemoteScope.js"
import type { KiruRedirect } from "./remoteRequestEvent.js"

export type {
  ActionSchema,
  InferSchemaOutput,
  Schema,
  StandardJSONSchema,
  StandardJSONSchemaV1,
  StandardSchema,
  StandardSchemaV1,
  StandardSchemaWithJson,
} from "../validation/index.js"
export {
  isStandardJSONSchemaV1,
  isStandardSchemaV1,
  parseInput,
  toInputJsonSchema,
  toOutputJsonSchema,
} from "../validation/index.js"

export type {
  RemoteExecution,
  RemoteExecutionFrame,
  RequestEnvelope,
  RuntimeContext,
  ExecutionState,
  MiddlewareState,
  CacheScope,
  TraceContext,
  TraceSpan,
  Transaction,
  CreateRemoteExecutionOptions,
} from "./remoteExecution.js"
export {
  createRemoteExecution,
  createRemoteFrame,
  createCacheScope,
  createTraceContext,
  headersToValidationInput,
  listRemoteFrames,
} from "./remoteExecution.js"
export { getRemoteExecutionContext } from "./remoteInvokeScope.js"

export type ActionRequest<Body = unknown, Query = void> = {
  body: Body
  query: Query
  /** Incoming request headers (lowercase keys; first value wins). */
  headers: Record<string, string>
}

export type ActionResponse = {
  /** Outgoing response headers for this action. */
  headers: Headers
  cookies: RemoteCookies
}

/** Arguments passed to remote action handlers (internal scope wiring). */
export type RemoteHandlerArgs<Body, Query = void> = {
  request: ActionRequest<Body, Query>
  response: ActionResponse
  context: CustomRequestContext
  signal: AbortSignal
}

/** Registry / HTTP entry invoke shape (unknown at the boundary). */
export type RemoteInvokeArgs = {
  body: unknown
  query: Record<string, string | string[]>
  context: CustomRequestContext
  signal: AbortSignal
  request: Request
  execution?: RemoteExecution
}

export function buildRemoteHandlerArgs<Body, Query = void>(
  context: CustomRequestContext,
  signal: AbortSignal,
  body: Body,
  query: Query
): RemoteHandlerArgs<Body, Query> {
  return {
    request: {
      body,
      query,
      headers: {},
    },
    response: {
      headers: new Headers(),
      cookies: new RemoteCookies(),
    },
    context,
    signal,
  }
}

/** Parse URL search params for an action RPC (excludes `action`). */
export function parseActionQueryFromUrl(
  url: URL
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "action") continue
    const existing = out[key]
    if (existing === undefined) {
      out[key] = value
    } else if (Array.isArray(existing)) {
      existing.push(value)
    } else {
      out[key] = [existing, value]
    }
  }
  return out
}

/** Serialize client `query` for appending to `/?action=…` (no leading `?`). */
export function serializeActionCallQuery(
  query: Record<string, unknown>
): string {
  return serializeValidatedQuery(query)
}

/** Active SSR handler args while inside a sync `runWithSsrRequestContext` scope. */
export function __getSsrRemoteContext(): RemoteHandlerArgs<void, void> {
  const entry = getSsrRemoteScopeEntry()
  if (!entry) {
    return buildRemoteHandlerArgs(
      {},
      new AbortController().signal,
      undefined,
      undefined
    )
  }
  return buildRemoteHandlerArgs(
    entry.context,
    entry.signal,
    undefined,
    undefined
  )
}

/** Request context from the active SSR action scope. */
export function __getSsrRequestContext(): CustomRequestContext {
  return __getSsrRemoteContext().context
}

/** Run synchronous SSR render work with action context (nested save/restore). */
export function runWithSsrRequestContext<T>(
  ctx: CustomRequestContext,
  signal: AbortSignal,
  fn: () => T
): T {
  return runWithSsrRemoteContext(ctx, signal, fn)
}

export {
  redirect,
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  formDataToInput,
  type KiruRedirect,
  type KiruSetCookie,
  type KiruActionResponseOptions,
} from "./remoteRequestEvent.js"

/** Client-visible success output from a form mutation (excludes redirect / fail). */
export type RemoteFormClientOutput<T> = T

/** Server handler return before HTTP serialization. */
export type KiruRemoteServerResult<Output> = Output | KiruRedirect

export { RemoteCookies } from "./remoteCookies.js"
export type { RemoteCookieDefaults, RemoteCookieSetOptions } from "./remoteCookies.js"

export type RemoteFormInvokeArgs = {
  formData: FormData
  signal: AbortSignal
}
