import { AsyncLocalStorage } from "node:async_hooks"
import type { RemoteRequestEvent } from "./remoteRequestEvent.js"

const remoteRequestEventAls = new AsyncLocalStorage<RemoteRequestEvent>()

export function getRequestEvent(): RemoteRequestEvent {
  const event = remoteRequestEventAls.getStore()
  if (!event) {
    throw new Error(
      "getRequestEvent() can only be called inside a remote handler (query, mutation, or form)."
    )
  }
  return event
}

export function runWithRemoteRequestEvent<T>(
  event: RemoteRequestEvent,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return remoteRequestEventAls.run(event, fn)
}
