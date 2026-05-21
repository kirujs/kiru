import { AsyncLocalStorage } from "node:async_hooks"
import type { RemoteActionHandlerArgs } from "./action.js"
import {
  createActionExecution,
  createActionFrame,
  type ActionExecution,
  type CreateActionExecutionOptions,
} from "./actionExecution.js"

const actionExecutionAls = new AsyncLocalStorage<ActionExecution>()

export function getActiveActionExecution(): ActionExecution | undefined {
  return actionExecutionAls.getStore()
}

export function toRemoteActionHandlerArgs<Input>(
  execution: ActionExecution,
  input: Input
): RemoteActionHandlerArgs<Input> {
  return {
    input,
    context: execution.request.context,
    signal: execution.request.signal,
    execution,
  }
}

/** Active handler args when inside RPC/composition (void `input`). */
export function getActiveActionContext(): RemoteActionHandlerArgs<void> | undefined {
  const execution = getActiveActionExecution()
  if (!execution) return undefined
  return toRemoteActionHandlerArgs(execution, undefined)
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
  const execution = actionExecutionAls.getStore()
  if (!execution) {
    throw new Error(
      "runWithActionFrame called without an active ActionExecution (missing runInActionExecution?)"
    )
  }

  const { runtime } = execution
  const parent = runtime.currentFrame
  const span = runtime.tracing.startSpan(actionId, { actionId })
  const frame = createActionFrame(actionId, parent, meta)
  runtime.currentFrame = frame

  const finish = () => {
    frame.endedAt = Date.now()
    runtime.currentFrame = parent
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
