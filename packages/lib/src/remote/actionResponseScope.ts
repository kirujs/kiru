import type { CustomRequestContext } from "../router/types.js"
import type { ActionExecution } from "./actionExecution.js"
import { headersToValidationInput } from "./actionExecution.js"
import type { RemoteActionHandlerArgs } from "./action.js"
import type { KiruSetCookie } from "./action.js"
import { isKiruRedirect } from "./action.js"
import { ActionCookies } from "./actionCookies.js"

export type CommittedResponseMeta = {
  cookies: readonly KiruSetCookie[]
  context?: CustomRequestContext
  responseHeaders: Headers
}

export type ActionResponseScope = {
  readonly context: CustomRequestContext
  readonly headers: Headers
  readonly cookies: ActionCookies
  readonly entryContextSnapshot: string
  toHandlerArgs<Body, Query>(
    body: Body,
    query: Query
  ): RemoteActionHandlerArgs<Body, Query>
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

export function createActionResponseScope(
  execution: ActionExecution
): ActionResponseScope {
  const context = cloneContext(execution.request.context)
  const headers = new Headers()
  const cookies = new ActionCookies()
  const entryContextSnapshot = stableSerialize(execution.request.context)

  return {
    context,
    headers,
    cookies,
    entryContextSnapshot,
    toHandlerArgs<Body, Query>(body: Body, query: Query) {
      return {
        body,
        query,
        headers,
        cookies,
        context,
        signal: execution.request.signal,
      }
    },
  }
}

export function commitActionResponseScope(
  scope: ActionResponseScope,
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

const scopeByExecution = new WeakMap<ActionExecution, ActionResponseScope>()

export function getActionResponseScope(
  execution: ActionExecution
): ActionResponseScope | undefined {
  return scopeByExecution.get(execution)
}

export async function runWithActionResponseScope<T>(
  execution: ActionExecution,
  run: (scope: ActionResponseScope) => T | Promise<T>
): Promise<HandlerWithScopeResult> {
  const scope = createActionResponseScope(execution)
  scopeByExecution.set(execution, scope)
  try {
    const handlerResult = await run(scope)
    const redirectOptions = isKiruRedirect(handlerResult)
      ? {
          cookies: handlerResult.cookies,
          context: handlerResult.context,
        }
      : undefined
    const meta = commitActionResponseScope(scope, handlerResult, redirectOptions)
    return { handlerResult, meta }
  } finally {
    scopeByExecution.delete(execution)
  }
}

/** Request headers for middleware (incoming), not response {@link Headers}. */
export function requestHeadersRecord(execution: ActionExecution): Record<string, string> {
  return headersToValidationInput(execution.request.headers)
}
