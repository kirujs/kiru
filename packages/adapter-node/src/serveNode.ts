import { createServer } from "node:http"
import {
  nodeRequestToFetch,
  sendFetchToNodeResponse,
} from "./nodeBridge.js"
import { resolveKiruFetch } from "@kirujs/adapter-contract"
import type { KiruFetch, KiruResponder } from "./types.js"

/**
 * Listen with Node's built-in HTTP server (no HTTP framework required).
 */
export function serveKiruNode(
  handler: KiruResponder | KiruFetch,
  port = Number(process.env.PORT) || 3000
): ReturnType<typeof createServer> {
  const fetch = resolveKiruFetch(handler)
  const server = createServer(async (req, res) => {
    try {
      const response = await fetch(nodeRequestToFetch(req))
      await sendFetchToNodeResponse(res, response)
    } catch (err) {
      res.statusCode = 500
      res.end(err instanceof Error ? err.message : String(err))
    }
  })
  server.listen(port, () => {
    console.log(
      `[@kirujs/adapter-node] listening on http://localhost:${port}`
    )
  })
  return server
}
