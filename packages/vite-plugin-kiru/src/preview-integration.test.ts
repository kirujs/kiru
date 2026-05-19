import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { createSsgPreviewMiddleware } from "./preview-server.js"
import { createPreviewSsrProxy } from "./previewSsrProxy.js"

const repoRoot = path.resolve(import.meta.dirname, "../../..")
const ssrClient = path.join(repoRoot, "e2e/ssr/dist/client")
const ssrServer = path.join(repoRoot, "e2e/ssr/dist/server/index.js")

function runMiddleware(
  middleware: ReturnType<typeof createSsgPreviewMiddleware>,
  url: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = []
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string | number | string[]>,
      setHeader() {},
      write(chunk: string | Buffer) {
        chunks.push(
          typeof chunk === "string" ? chunk : chunk.toString("utf8")
        )
      },
      end(body?: string | Buffer) {
        if (body !== undefined) {
          chunks.push(
            typeof body === "string" ? body : body.toString("utf8")
          )
        }
        resolve({ status: this.statusCode, body: chunks.join("") })
      },
    }
    middleware(
      { url, headers: { host: "127.0.0.1", accept: "text/html" } } as any,
      res as any,
      (err?: unknown) => (err ? reject(err) : resolve({ status: 404, body: "" }))
    )
  })
}

describe("preview integration", { skip: !fs.existsSync(ssrClient) }, () => {
  it("vite preview serves prerendered and SSR routes (e2e/ssr)", async () => {
    const { preview } = await import("vite")
    const configFile = path.join(repoRoot, "e2e/ssr/vite.config.ts")
    const root = path.dirname(configFile)
    const server = await preview({
      configFile,
      root,
      preview: { port: 0, strictPort: false, host: "127.0.0.1" },
    })
    try {
      const localUrl = server.resolvedUrls?.local?.[0]
      assert.ok(localUrl, "vite preview did not resolve a local URL")
      const base = localUrl.replace(/\/$/, "")
      const docs = await fetch(`${base}/docs`)
      const docsText = await docs.text()
      assert.equal(
        docs.status,
        200,
        `GET ${base}/docs failed (body: ${docsText.slice(0, 120)})`
      )
      assert.match(docsText, /ssr-docs-static/)

      const hello = await fetch(`${base}/hello`)
      const helloText = await hello.text()
      assert.equal(hello.status, 200)
      assert.doesNotMatch(helloText, /ssr-not-found/)
    } finally {
      await server.close()
    }
  })

  it("SSG middleware serves hybrid prerender docs.html", async () => {
    const res = await runMiddleware(
      createSsgPreviewMiddleware(ssrClient, { requireFilledHtml: true }),
      "/docs"
    )
    assert.equal(res.status, 200)
    assert.match(res.body, /ssr-docs-static/)
  })

  it("SSR preview proxy renders a dynamic route", async () => {
    const handle = await createPreviewSsrProxy(ssrServer)
    try {
      const direct = await fetch(`${handle.baseUrl}/hello`)
      assert.equal(direct.status, 200, await direct.text())
      const res = await runMiddleware(handle.middleware, "/hello")
      assert.equal(res.status, 200, res.body.slice(0, 200))
      assert.doesNotMatch(res.body, /ssr-not-found/)
      assert.match(res.body, /ssr-layout/)
    } finally {
      handle.dispose()
    }
  })
})
