import type { IncomingMessage, ServerResponse } from "node:http"
import {
  bindClientDisconnectAbort,
  nodeRequestToFetch,
  writeNodeResponse,
} from "./nodeBridge.js"
import type { KiruFetch, KiruResponder } from "./types.js"

/** Node `http` request listener for a {@link KiruResponder} or Web `fetch` handler. */
export function toNodeListener(
  handler: KiruResponder | KiruFetch
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const fetch =
    typeof handler === "function" ? handler : handler.fetch.bind(handler)
  return async (req, res) => {
    const { request, abort } = nodeRequestToFetch(req)
    const unbind = bindClientDisconnectAbort(res, abort)
    try {
      const response = await fetch(request)
      await writeNodeResponse(res, response, abort.signal)
    } catch (err) {
      if (abort.signal.aborted) {
        if (!res.writableEnded) res.end()
        return
      }
      res.statusCode = 500
      res.end(err instanceof Error ? err.message : String(err))
    } finally {
      unbind()
    }
  }
}
