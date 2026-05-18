import type { IncomingMessage, ServerResponse } from "node:http"
import { createServer } from "node:http"
import { Readable } from "node:stream"
import type { KiruFetch, KiruHandler } from "./types.js"

function resolveFetch(handler: KiruHandler | KiruFetch): KiruFetch {
  return typeof handler === "function" ? handler : handler.fetch.bind(handler)
}

function nodeToFetchRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? "localhost"
  const url = `http://${host}${req.url ?? "/"}`

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v))
    } else {
      headers.set(key, value)
    }
  }

  const method = (req.method ?? "GET").toUpperCase()
  const hasBody =
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS"

  if (hasBody) {
    return new Request(url, {
      method,
      headers,
      // @ts-expect-error — `duplex` not yet in all Request typedefs
      body: Readable.toWeb(req),
      duplex: "half",
    })
  }
  return new Request(url, { method, headers })
}

async function writeFetchResponse(
  res: ServerResponse,
  response: Response
): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "content-length") return
    res.setHeader(key, value)
  })

  if (!response.body) {
    res.end()
    return
  }

  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (typeof value === "string") {
        res.write(value)
      } else if (value instanceof Uint8Array) {
        res.write(Buffer.from(value))
      }
    }
  } finally {
    reader.releaseLock()
  }
  res.end()
}

/**
 * Listen with Node's built-in HTTP server (no Hono required).
 */
export function serveKiruNode(
  handler: KiruHandler | KiruFetch,
  port = Number(process.env.PORT) || 3000
): ReturnType<typeof createServer> {
  const fetch = resolveFetch(handler)
  const server = createServer(async (req, res) => {
    try {
      const response = await fetch(nodeToFetchRequest(req))
      await writeFetchResponse(res, response)
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
