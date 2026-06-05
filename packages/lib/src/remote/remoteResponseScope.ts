import type { CustomRequestContext } from "../router/types.js"
import type { RemoteExecution } from "./remoteExecution.js"
import { headersToValidationInput } from "./remoteExecution.js"
import type { RemoteHandlerArgs } from "./action.js"
import { isKiruRedirect, type KiruSetCookie } from "./kiruRedirect.js"
import { RemoteCookies } from "./remoteCookies.js"

export type CommittedResponseMeta = {
  cookies: readonly KiruSetCookie[]
  context?: CustomRequestContext
  responseHeaders: Headers
}

export type RemoteResponseScope = {
  readonly context: CustomRequestContext
  readonly headers: Headers
  readonly cookies: RemoteCookies
  readonly entryContextSnapshot: string
  toHandlerArgs<Body, Query>(
    body: Body,
    query: Query
  ): RemoteHandlerArgs<Body, Query>
}

function cloneContext(context: CustomRequestContext): CustomRequestContext {
  if (typeof structuredClone === "function") {
    return structuredClone(context) as CustomRequestContext
  }
  return JSON.parse(JSON.stringify(context)) as CustomRequestContext
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(sortKeys)
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeys(obj[key])
  }
  return out
}

export function createRemoteResponseScope(
  execution: RemoteExecution
): RemoteResponseScope {
  const context = cloneContext(execution.request.context)
  const headers = new Headers()
  const cookies = new RemoteCookies()
  const entryContextSnapshot = stableSerialize(execution.request.context)

  return {
    context,
    headers,
    cookies,
    entryContextSnapshot,
    toHandlerArgs<Body, Query>(body: Body, query: Query) {
      return {
        request: {
          body,
          query,
          headers: requestHeadersRecord(execution),
        },
        response: {
          headers,
          cookies,
        },
        context,
        signal: execution.request.signal,
      }
    },
  }
}

export function commitRemoteResponseScope(
  scope: RemoteResponseScope,
  _handlerResult: unknown,
  redirectOptions?: { cookies?: readonly KiruSetCookie[]; context?: CustomRequestContext }
): CommittedResponseMeta {
  const cookies = [...scope.cookies.toSetCookieList()]
  if (redirectOptions?.cookies?.length) {
    for (const c of redirectOptions.cookies) cookies.push(c)
  }

  let context: CustomRequestContext | undefined
  const serialized = stableSerialize(scope.context)
  if (serialized !== scope.entryContextSnapshot) {
    context = scope.context
  }
  if (redirectOptions?.context !== undefined) {
    context = redirectOptions.context
  }

  return {
    cookies,
    context,
    responseHeaders: scope.headers,
  }
}

export type HandlerWithScopeResult = {
  handlerResult: unknown
  meta: CommittedResponseMeta
}

const scopeByExecution = new WeakMap<RemoteExecution, RemoteResponseScope>()

export function getRemoteResponseScope(
  execution: RemoteExecution
): RemoteResponseScope | undefined {
  return scopeByExecution.get(execution)
}

export async function runWithRemoteResponseScope<T>(
  execution: RemoteExecution,
  run: (scope: RemoteResponseScope) => T | Promise<T>
): Promise<HandlerWithScopeResult> {
  const scope = createRemoteResponseScope(execution)
  scopeByExecution.set(execution, scope)
  try {
    const handlerResult = await run(scope)
    const redirectOptions = isKiruRedirect(handlerResult)
      ? {
          cookies: handlerResult.cookies,
          context: handlerResult.context,
        }
      : undefined
    const meta = commitRemoteResponseScope(scope, handlerResult, redirectOptions)
    return { handlerResult, meta }
  } finally {
    scopeByExecution.delete(execution)
  }
}

/** Request headers for middleware (incoming), not response {@link Headers}. */
export function requestHeadersRecord(execution: RemoteExecution): Record<string, string> {
  return headersToValidationInput(execution.request.headers)
}
