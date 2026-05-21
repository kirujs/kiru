import type { RemoteActionHandlerArgs } from "./action.js"
import type {
  ActionExecution,
  CreateActionExecutionOptions,
} from "./actionExecution.js"

export function getActiveActionExecution(): ActionExecution | undefined {
  return undefined
}

export function getActiveActionContext(): RemoteActionHandlerArgs<void> | undefined {
  return undefined
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

export function createActionExecutionForRequest(
  _options: CreateActionExecutionOptions
): ActionExecution {
  throw new Error("ActionExecution is not available in the browser bundle")
}

export function runInActionExecution<T>(
  _execution: ActionExecution,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return fn()
}

export function runWithActionFrame<T>(
  _actionId: string,
  fn: () => T | Promise<T>,
  _meta?: Record<string, unknown>
): T | Promise<T> {
  return fn()
}
