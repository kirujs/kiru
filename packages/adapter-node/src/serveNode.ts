import type { IncomingMessage, ServerResponse } from "node:http"
import {
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
    try {
      const response = await fetch(nodeRequestToFetch(req))
      await writeNodeResponse(res, response)
    } catch (err) {
      res.statusCode = 500
      res.end(err instanceof Error ? err.message : String(err))
    }
  }
}
