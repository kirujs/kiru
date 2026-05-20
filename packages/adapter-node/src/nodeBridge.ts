import type { IncomingMessage, ServerResponse } from "node:http"
import { Readable } from "node:stream"

export { resolveKiruHandle } from "@kirujs/adapter-contract"

export type NodeFetchRequest = {
  request: Request
  /** Shared with `request.signal`; abort when the client disconnects. */
  abort: AbortController
}

function abortUnlessResponseFinished(
  res: ServerResponse,
  abort: AbortController
): void {
  if (abort.signal.aborted) return
  if (res.writableEnded || res.writableFinished) return
  abort.abort()
}

/** Convert a Node.js `IncomingMessage` into a Web `Request` with a linked abort signal. */
export function nodeRequestToFetch(req: IncomingMessage): NodeFetchRequest {
  const abort = new AbortController()
  const abortFromSocket = () => abort.abort()
  req.once("aborted", abortFromSocket)
  req.once("error", abortFromSocket)

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

  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    signal: abort.signal,
  }

  if (hasBody) {
    init.body = Readable.toWeb(req) as BodyInit
    init.duplex = "half"
  }

  return { request: new Request(url, init), abort }
}

/** Abort in-flight SSR when the client closes the connection before the response finishes. */
export function bindClientDisconnectAbort(
  res: ServerResponse,
  abort: AbortController
): () => void {
  const onResClose = () => abortUnlessResponseFinished(res, abort)
  res.on("close", onResClose)
  return () => {
    res.off("close", onResClose)
  }
}

/** Write a Web `Response` to a Node.js `ServerResponse`. */
export async function writeNodeResponse(
  res: ServerResponse,
  response: Response,
  renderSignal?: AbortSignal
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
  const onAbort = () => {
    void reader.cancel()
  }
  renderSignal?.addEventListener("abort", onAbort)

  try {
    while (true) {
      if (renderSignal?.aborted) {
        await reader.cancel()
        break
      }
      const { done, value } = await reader.read()
      if (done) break
      if (renderSignal?.aborted) {
        await reader.cancel()
        break
      }
      if (typeof value === "string") {
        res.write(value)
      } else if (value instanceof Uint8Array) {
        res.write(Buffer.from(value))
      }
    }
  } finally {
    renderSignal?.removeEventListener("abort", onAbort)
    reader.releaseLock()
  }
  if (!res.writableEnded) {
    res.end()
  }
}
