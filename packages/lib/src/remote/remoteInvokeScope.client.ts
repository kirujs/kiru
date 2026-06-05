import type { RemoteHandlerArgs } from "./action.js"
import { RemoteCookies } from "./remoteCookies.js"
import { headersToValidationInput } from "./remoteExecution.js"
import type {
  RemoteExecution,
  CreateRemoteExecutionOptions,
} from "./remoteExecution.js"

export function getRemoteExecutionContext(): RemoteExecution | undefined {
  return undefined
}

export function getActiveRemoteContext(): RemoteHandlerArgs<
  void,
  void
> | undefined {
  return undefined
}

export function toRemoteHandlerArgs<Body, Query = void>(
  execution: RemoteExecution,
  body: Body,
  query: Query
): RemoteHandlerArgs<Body, Query> {
  return {
    request: {
      body,
      query,
      headers: headersToValidationInput(execution.request.headers),
    },
    response: {
      headers: new Headers(),
      cookies: new RemoteCookies(),
    },
    context: execution.request.context,
    signal: execution.request.signal,
  }
}

export function createRemoteExecutionForRequest(
  _options: CreateRemoteExecutionOptions
): RemoteExecution {
  throw new Error("RemoteExecution is not available in the browser bundle")
}

export function runInRemoteExecution<T>(
  _execution: RemoteExecution,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return fn()
}

export function runWithRemoteFrame<T>(
  _actionId: string,
  fn: () => T | Promise<T>,
  _meta?: Record<string, unknown>
): T | Promise<T> {
  return fn()
}
