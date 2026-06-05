import type { CustomRequestContext } from "../router/types.js"
import type { RemoteCookies } from "./remoteCookies.js"
import type { RemoteRequestEvent } from "./remoteRequestEvent.js"
import { assertServerOnly } from "./serverOnly.js"

export {
  formDataToInput,
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  redirect,
  type KiruActionResponseOptions,
  type KiruRedirect,
  type KiruSetCookie,
} from "./kiruRedirect.js"

export function buildRemoteRequestEvent(_params: {
  headers: Record<string, string>
  formData?: FormData
  body?: unknown
  context: CustomRequestContext
  responseHeaders: Headers
  cookies: RemoteCookies
  signal: AbortSignal
}): RemoteRequestEvent {
  assertServerOnly(
    "buildRemoteRequestEvent",
    "buildRemoteRequestEvent() can only be called on the server."
  )
}

export function getRequestEvent(): RemoteRequestEvent {
  assertServerOnly(
    "getRequestEvent",
    "getRequestEvent() can only be called inside a remote handler on the server."
  )
}

export function runWithRemoteRequestEvent<T>(
  _event: RemoteRequestEvent,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return fn()
}
