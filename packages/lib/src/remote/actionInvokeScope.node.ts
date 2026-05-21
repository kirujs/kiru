import { AsyncLocalStorage } from "node:async_hooks"
import type { RemoteActionHandlerArgs } from "./action.js"
import {
  createActionExecution,
  createActionFrame,
  headersToValidationInput,
  type ActionExecution,
  type CreateActionExecutionOptions,
} from "./actionExecution.js"

const actionExecutionAls = new AsyncLocalStorage<ActionExecution>()

export function getActionExecutionContext(): ActionExecution | undefined {
  return actionExecutionAls.getStore()
}

export function toRemoteActionHandlerArgs<Body, Query = void>(
  execution: ActionExecution,
  body: Body,
  query: Query,
  headers?: Record<string, string>
): RemoteActionHandlerArgs<Body, Query> {
  return {
    body,
    query,
    headers:
      headers ?? headersToValidationInput(execution.request.headers),
    context: execution.request.context,
    signal: execution.request.signal,
  }
}

/** Active flat handler args when inside RPC/composition (pre-validation placeholders). */
export function getActiveActionContext(): RemoteActionHandlerArgs<
  void,
  void
> | undefined {
  const execution = getActionExecutionContext()
  if (!execution) return undefined
  return toRemoteActionHandlerArgs(
    execution,
    undefined as void,
    undefined as void
  )
}

export function createActionExecutionForRequest(
  options: CreateActionExecutionOptions
): ActionExecution {
  return createActionExecution(options)
}

/** Bind one {@link ActionExecution} to the current async context (HTTP entry). */
export function runInActionExecution<T>(
  execution: ActionExecution,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return actionExecutionAls.run(execution, fn)
}

/**
 * Push a linked-list frame (`currentFrame.parent` chain), run `fn`, pop and set `endedAt`.
 * Shares {@link ActionExecution.request} and {@link ActionExecution.runtime} services.
 */
export function runWithActionFrame<T>(
  actionId: string,
  fn: () => T | Promise<T>,
  meta?: Record<string, unknown>
): T | Promise<T> {
  const store = actionExecutionAls.getStore()
  if (!store) {
    throw new Error(
      "runWithActionFrame called without an active ActionExecution (missing runInActionExecution?)"
    )
  }

  const { runtime, execution: execState } = store
  const parent = execState.currentFrame
  const span = runtime.tracing.startSpan(actionId, { actionId })
  const frame = createActionFrame(actionId, parent, meta)
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
