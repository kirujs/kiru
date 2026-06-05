import type { CustomRequestContext } from "../router/types.js"
import type { RemoteCookies } from "./remoteCookies.js"
import type { KiruRedirect, KiruSetCookie } from "./remoteRequestEvent.js"

export type RemoteHandlerContext = {
  context: CustomRequestContext
  response: {
    headers: Headers
    cookies: RemoteCookies
  }
  signal: AbortSignal
}

export type KiruRemoteServerResult<Output> = Output | KiruRedirect

export type { KiruRedirect, KiruSetCookie }
