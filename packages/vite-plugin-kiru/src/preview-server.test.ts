import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import {
  createSsgPreviewMiddleware,
  htmlCandidates,
  isFilledPrerenderHtml,
  isPreviewAssetPath,
  toPreviewPathname,
} from "./preview-server.js"

describe("preview-server", () => {
  it("toPreviewPathname strips query and hash", () => {
    assert.equal(toPreviewPathname("/about?q=1#top"), "/about")
    assert.equal(toPreviewPathname("/"), "/")
  })

  it("isPreviewAssetPath skips vite internals and non-html extensions", () => {
    assert.equal(isPreviewAssetPath("/@vite/client"), true)
    assert.equal(isPreviewAssetPath("/assets/index-abc.js"), true)
    assert.equal(isPreviewAssetPath("/about"), false)
    assert.equal(isPreviewAssetPath("/page.html"), false)
  })

  it("htmlCandidates maps public paths to prerender output files", () => {
    const out = "/out"
    assert.deepEqual(htmlCandidates(out, "/about"), [
      path.join(out, "about"),
      path.join(out, "about.html"),
      path.join(out, "about", "index.html"),
    ])
    assert.deepEqual(htmlCandidates(out, "/posts/one"), [
      path.join(out, "posts", "one"),
      path.join(out, "posts", "one.html"),
      path.join(out, "posts", "one", "index.html"),
    ])
    assert.deepEqual(htmlCandidates(out, "/posts/one/"), [
      path.join(out, "posts", "one", "index.html"),
    ])
  })

  it("isFilledPrerenderHtml rejects Vite shell placeholders", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiru-preview-shell-"))
    const shell = path.join(root, "index.html")
    fs.writeFileSync(
      shell,
      "<html>{{kiru_head}}<body>{{kiru_body}}</body></html>"
    )
    const filled = path.join(root, "about.html")
    fs.writeFileSync(
      filled,
      "<html><!-- kiru:head --><title>x</title><!-- /kiru:head --><body>ok</body></html>"
    )
    assert.equal(isFilledPrerenderHtml(shell), false)
    assert.equal(isFilledPrerenderHtml(filled), true)
  })

  it("createSsgPreviewMiddleware serves flat and nested prerender files", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiru-preview-"))
    fs.writeFileSync(path.join(root, "about.html"), "<html>about</html>")
    fs.mkdirSync(path.join(root, "posts", "one"), { recursive: true })
    fs.writeFileSync(
      path.join(root, "posts", "one", "index.html"),
      "<html>post</html>"
    )

    const run = (url: string) =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
        const middleware = createSsgPreviewMiddleware(root)
        const res = {
          statusCode: 200,
          headers: {} as Record<string, string | number | string[]>,
          setHeader(name: string, value: string | number) {
            this.headers[name.toLowerCase()] = value
          },
          end(body: Buffer) {
            resolve({
              status: this.statusCode,
              body: body.toString("utf8"),
            })
          },
        }
        middleware(
          { url } as any,
          res as any,
          (err?: unknown) => (err ? reject(err) : resolve({ status: 404, body: "" }))
        )
      })

    await Promise.all([
      run("/about").then((r) => {
        assert.equal(r.status, 200)
        assert.match(r.body, /about/)
      }),
      run("/posts/one").then((r) => {
        assert.equal(r.status, 200)
        assert.match(r.body, /post/)
      }),
    ])
  })

  it("hybrid-ssr skips shell index.html for hybrid preview", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiru-preview-hybrid-"))
    fs.writeFileSync(
      path.join(root, "index.html"),
      "<html>{{kiru_head}}{{kiru_body}}</html>"
    )
    fs.writeFileSync(
      path.join(root, "docs.html"),
      "<html><!-- kiru:head --><title>docs</title><!-- /kiru:head --><body>docs</body></html>"
    )

    const run = (url: string, strategy: "hybrid-ssr" | "exact") =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
        const middleware = createSsgPreviewMiddleware(root, {
          notFoundStrategy: strategy,
        })
        const res = {
          statusCode: 200,
          headers: {} as Record<string, string | number | string[]>,
          setHeader() {},
          end(body: Buffer) {
            resolve({ status: this.statusCode, body: body.toString("utf8") })
          },
        }
        middleware(
          { url } as any,
          res as any,
          (err?: unknown) => (err ? reject(err) : resolve({ status: 404, body: "" }))
        )
      })

    await Promise.all([
      run("/", "hybrid-ssr").then((r) => assert.equal(r.status, 404)),
      run("/docs", "hybrid-ssr").then((r) => {
        assert.equal(r.status, 200)
        assert.match(r.body, /docs/)
      }),
    ])
  })

  it("hybrid-ssr skips prerendered 404.html for unknown routes", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiru-preview-hybrid-404-"))
    fs.writeFileSync(path.join(root, "404.html"), "<html>prerendered 404</html>")

    const run = (url: string, strategy: "hybrid-ssr" | "exact") =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
        const middleware = createSsgPreviewMiddleware(root, {
          notFoundStrategy: strategy,
        })
        const res = {
          statusCode: 200,
          headers: {} as Record<string, string | number | string[]>,
          setHeader() {},
          end(body: Buffer) {
            resolve({ status: this.statusCode, body: body.toString("utf8") })
          },
        }
        middleware(
          { url } as any,
          res as any,
          (err?: unknown) => (err ? reject(err) : resolve({ status: 404, body: "" }))
        )
      })

    await Promise.all([
      run("/hello", "hybrid-ssr").then((r) => {
        assert.equal(r.status, 404)
        assert.equal(r.body, "")
      }),
      run("/hello", "exact").then((r) => {
        assert.equal(r.status, 404)
        assert.match(r.body, /prerendered 404/)
      }),
    ])
  })

  it("csr-recovery serves index.html with 200 for unknown routes", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiru-preview-csr-"))
    fs.writeFileSync(
      path.join(root, "index.html"),
      "<html><!-- kiru:head --><title>app</title><!-- /kiru:head --><body>shell</body></html>"
    )

    const run = (url: string) =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
        const middleware = createSsgPreviewMiddleware(root, {
          notFoundStrategy: "csr-recovery",
        })
        const res = {
          statusCode: 200,
          headers: {} as Record<string, string | number | string[]>,
          setHeader() {},
          end(body: Buffer) {
            resolve({ status: this.statusCode, body: body.toString("utf8") })
          },
        }
        middleware(
          { url } as any,
          res as any,
          (err?: unknown) => (err ? reject(err) : resolve({ status: 404, body: "" }))
        )
      })

    const r = await run("/unknown-route")
    assert.equal(r.status, 200)
    assert.match(r.body, /shell/)
  })
})
