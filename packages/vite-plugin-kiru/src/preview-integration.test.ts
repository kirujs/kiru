import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { before, describe, it } from "node:test"
import { createSsgPreviewMiddleware } from "./preview-server.js"
import { createPreviewSsrProxy } from "./previewSsrProxy.js"

const repoRoot = path.resolve(import.meta.dirname, "../../..")
const ssrRoot = path.join(repoRoot, "e2e/ssr")
const ssrClient = path.join(ssrRoot, "dist/client")
const ssrServer = path.join(ssrRoot, "dist/server/index.js")

/** Rebuild when dist is missing or predates the createRouteTree route API. */
async function ensureSsrPreviewFixture(): Promise<void> {
  let stale = !fs.existsSync(ssrClient) || !fs.existsSync(ssrServer)
  if (!stale) {
    const serverSrc = await fs.promises.readFile(ssrServer, "utf8")
    stale =
      serverSrc.includes("defineRouteTree") ||
      !serverSrc.includes("createRouteTree")
  }
  if (!stale) return
  execSync("pnpm run build", {
    cwd: ssrRoot,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  })
}

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

describe("preview integration", () => {
  before(async () => {
    await ensureSsrPreviewFixture()
  })

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
      createSsgPreviewMiddleware(ssrClient, { notFoundStrategy: "hybrid-ssr" }),
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

  it("SSR preview proxy forwards query string on GET", async () => {
    const handle = await createPreviewSsrProxy(ssrServer)
    try {
      const res = await runMiddleware(
        handle.middleware,
        "/search-schema?q=proxy-query"
      )
      assert.equal(res.status, 200, res.body.slice(0, 200))
      assert.match(res.body, /search-schema/)
      assert.match(res.body, /proxy-query/)
    } finally {
      handle.dispose()
    }
  })

  it("SSR preview proxy forwards POST ?loader= RPC", async () => {
    const handle = await createPreviewSsrProxy(ssrServer)
    const http = await import("node:http")
    const server = http.createServer((req, res) => {
      handle.middleware(req, res, () => {
        res.statusCode = 404
        res.end("next")
      })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const addr = server.address()
    const listenPort = typeof addr === "object" && addr ? addr.port : 0
    try {
      const loaderUrl = `http://127.0.0.1:${listenPort}/?loader=${encodeURIComponent("route:load")}`
      const res = await fetch(loaderUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiru-token": "invalid",
        },
        body: JSON.stringify({}),
      })
      assert.notEqual(res.status, 404, await res.text())
      assert.ok(
        res.status === 400 || res.status === 500,
        `expected loader RPC to reach SSR server, got ${res.status}`
      )
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      )
      handle.dispose()
    }
  })
})
