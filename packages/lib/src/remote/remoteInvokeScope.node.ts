import { AsyncLocalStorage } from "node:async_hooks"
import type { RemoteHandlerArgs } from "./action.js"
import {
  createRemoteExecution,
  createRemoteFrame,
  type RemoteExecution,
  type CreateRemoteExecutionOptions,
} from "./remoteExecution.js"
import { RemoteCookies } from "./remoteCookies.js"
import { requestHeadersRecord } from "./remoteResponseScope.js"
import { getRemoteResponseScope } from "./remoteResponseScope.js"

const actionExecutionAls = new AsyncLocalStorage<RemoteExecution>()

export function getRemoteExecutionContext(): RemoteExecution | undefined {
  return actionExecutionAls.getStore()
}

export function toRemoteHandlerArgs<Body, Query = void>(
  execution: RemoteExecution,
  body: Body,
  query: Query
): RemoteHandlerArgs<Body, Query> {
  const scope = getRemoteResponseScope(execution)
  if (scope) {
    return scope.toHandlerArgs(body, query)
  }
  return {
    request: {
      body,
      query,
      headers: requestHeadersRecord(execution),
    },
    response: {
      headers: new Headers(),
      cookies: new RemoteCookies(),
    },
    context: execution.request.context,
    signal: execution.request.signal,
  }
}

/** Active flat handler args when inside RPC/composition (pre-validation placeholders). */
export function getActiveRemoteContext(): RemoteHandlerArgs<
  void,
  void
> | undefined {
  const execution = getRemoteExecutionContext()
  if (!execution) return undefined
  const scope = getRemoteResponseScope(execution)
  if (scope) {
    return scope.toHandlerArgs(undefined as void, undefined as void)
  }
  return toRemoteHandlerArgs(
    execution,
    undefined as void,
    undefined as void
  )
}

export function createRemoteExecutionForRequest(
  options: CreateRemoteExecutionOptions
): RemoteExecution {
  return createRemoteExecution(options)
}

/** Bind one {@link RemoteExecution} to the current async context (HTTP entry). */
export function runInRemoteExecution<T>(
  execution: RemoteExecution,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return actionExecutionAls.run(execution, fn)
}

/**
 * Push a linked-list frame (`currentFrame.parent` chain), run `fn`, pop and set `endedAt`.
 * Shares {@link RemoteExecution.request} and {@link RemoteExecution.runtime} services.
 */
export function runWithRemoteFrame<T>(
  actionId: string,
  fn: () => T | Promise<T>,
  meta?: Record<string, unknown>
): T | Promise<T> {
  const store = actionExecutionAls.getStore()
  if (!store) {
    throw new Error(
      "runWithRemoteFrame called without an active RemoteExecution (missing runInRemoteExecution?)"
    )
  }

  const { runtime, execution: execState } = store
  const parent = execState.currentFrame
  const span = runtime.tracing.startSpan(actionId, { actionId })
  const frame = createRemoteFrame(actionId, parent, meta)
  execState.currentFrame = frame

  const finish = () => {
    frame.endedAt = Date.now()
    execState.currentFrame = parent
    runtime.tracing.endSpan(span)
  }

  try {
    const result = fn()
    if (result != null && typeof (result as Promise<T>).then === "function") {
      return (result as Promise<T>).finally(finish)
    }
    finish()
    return result
  } catch (e) {
    finish()
    throw e
  }
}
