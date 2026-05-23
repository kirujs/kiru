import type { RemoteActionHandlerArgs } from "./action.js"
import { ActionCookies } from "./actionCookies.js"
import type {
  ActionExecution,
  CreateActionExecutionOptions,
} from "./actionExecution.js"

export function getActionExecutionContext(): ActionExecution | undefined {
  return undefined
}

export function getActiveActionContext(): RemoteActionHandlerArgs<
  void,
  void
> | undefined {
  return undefined
}

export function toRemoteActionHandlerArgs<Body, Query = void>(
  execution: ActionExecution,
  body: Body,
  query: Query
): RemoteActionHandlerArgs<Body, Query> {
  return {
    body,
    query,
    headers: new Headers(),
    cookies: new ActionCookies(),
    context: execution.request.context,
    signal: execution.request.signal,
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
