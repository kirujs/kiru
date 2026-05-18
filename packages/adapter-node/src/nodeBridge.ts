import type { IncomingMessage, ServerResponse } from "node:http"
import { Readable } from "node:stream"
import { toWebResponse, type KiruResponse } from "@kirujs/adapter-contract"

export { resolveKiruFetch, resolveKiruHandle } from "@kirujs/adapter-contract"

/** Convert a Node.js `IncomingMessage` into a Web `Request`. */
export function nodeRequestToFetch(req: IncomingMessage): Request {
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

/** Write a Web `Response` to a Node.js `ServerResponse`. */
export async function sendFetchToNodeResponse(
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

/** Write a {@link KiruResponse} to a Node.js `ServerResponse`. */
export async function sendKiruResponse(
  res: ServerResponse,
  kiru: KiruResponse
): Promise<void> {
  await sendFetchToNodeResponse(res, toWebResponse(kiru))
}
