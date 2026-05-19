import { describe, it } from "node:test"
import assert from "node:assert"
import { createServer, request as httpRequest } from "node:http"
import {
  nodeRequestToFetch,
  writeNodeResponse,
} from "./nodeBridge.js"
import { toNodeListener } from "./serveNode.js"
import type { KiruFetch, KiruResponder } from "./types.js"

function listen(
  handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void
): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler)
    server.listen(0, () => {
      const addr = server.address()
      if (!addr || typeof addr === "string") {
        reject(new Error("no port"))
        return
      }
      resolve({
        port: addr.port,
        close: () =>
          new Promise((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      })
    })
  })
}

function httpFetch(port: number, path: string, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://127.0.0.1:${port}`)
    const req = httpRequest(
      url,
      { method: init?.method ?? "GET", headers: init?.headers as Record<string, string> },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => {
          const body = Buffer.concat(chunks)
          resolve(
            new Response(body, {
              status: res.statusCode ?? 200,
              headers: res.headers as HeadersInit,
            })
          )
        })
      }
    )
    req.on("error", reject)
    if (init?.body) req.write(init.body)
    req.end()
  })
}

describe("nodeBridge", () => {
  it("toNodeListener accepts handler object or function", async () => {
    const fn: KiruFetch = async () => new Response("fn")
    const handler: KiruResponder = {
      handle: async () => new Response("obj"),
      fetch: async () => new Response("obj"),
      renderer: {},
      clientDir: "",
      htmlTemplate: "",
    }
    const { port: portFn, close: closeFn } = await listen(toNodeListener(fn))
    const { port: portObj, close: closeObj } = await listen(toNodeListener(handler))
    try {
      assert.equal(await (await httpFetch(portFn, "/")).text(), "fn")
      assert.equal(await (await httpFetch(portObj, "/")).text(), "obj")
    } finally {
      await closeFn()
      await closeObj()
    }
  })

  it("round-trips GET through nodeRequestToFetch and writeNodeResponse", async () => {
    const { port, close } = await listen(async (req, res) => {
      const fetchReq = nodeRequestToFetch(req)
      assert.equal(new URL(fetchReq.url).pathname, "/hello")
      await writeNodeResponse(
        res,
        new Response("ok", {
          status: 201,
          headers: { "x-test": "1", "content-type": "text/plain" },
        })
      )
    })
    try {
      const response = await httpFetch(port, "/hello")
      assert.equal(response.status, 201)
      assert.equal(await response.text(), "ok")
      assert.equal(response.headers.get("x-test"), "1")
    } finally {
      await close()
    }
  })

  it("round-trips POST body", async () => {
    const { port, close } = await listen(async (req, res) => {
      const fetchReq = nodeRequestToFetch(req)
      assert.equal(fetchReq.method, "POST")
      assert.equal(await fetchReq.text(), "payload")
      await writeNodeResponse(res, new Response("received"))
    })
    try {
      const response = await httpFetch(port, "/post", {
        method: "POST",
        body: "payload",
        headers: { "content-type": "text/plain" },
      })
      assert.equal(await response.text(), "received")
    } finally {
      await close()
    }
  })
})
