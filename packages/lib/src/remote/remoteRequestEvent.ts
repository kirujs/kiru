import type { CustomRequestContext } from "../router/types.js"
import type { RemoteCookies } from "./remoteCookies.js"
import {
  formDataToInput,
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  redirect,
  type KiruActionResponseOptions,
  type KiruRedirect,
  type KiruSetCookie,
} from "./kiruRedirect.js"

export {
  formDataToInput,
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  redirect,
  type KiruActionResponseOptions,
  type KiruRedirect,
  type KiruSetCookie,
}

export type RemoteRequestEvent = {
  request: {
    headers: Record<string, string>
    formData?: FormData
    body?: unknown
  }
  context: CustomRequestContext
  cookies: RemoteCookies
  response: { headers: Headers; cookies: RemoteCookies }
  signal: AbortSignal
  redirect: (
    status: number,
    location: string,
    options?: KiruActionResponseOptions
  ) => KiruRedirect
}

export function buildRemoteRequestEvent(params: {
  headers: Record<string, string>
  formData?: FormData
  body?: unknown
  context: CustomRequestContext
  responseHeaders: Headers
  cookies: RemoteCookies
  signal: AbortSignal
}): RemoteRequestEvent {
  return {
    request: {
      headers: params.headers,
      formData: params.formData,
      body: params.body,
    },
    context: params.context,
    cookies: params.cookies,
    response: {
      headers: params.responseHeaders,
      cookies: params.cookies,
    },
    signal: params.signal,
    redirect,
  }
}

export {
  getRequestEvent,
  runWithRemoteRequestEvent,
} from "./remoteRequestEvent.node.js"
