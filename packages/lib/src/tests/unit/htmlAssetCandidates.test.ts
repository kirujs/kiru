import assert from "node:assert/strict"
import path from "node:path"
import { describe, it } from "node:test"
import {
  inferNotFoundStrategy,
  normalizeAssetPathname,
  resolveHtmlAssetCandidates,
} from "../../router/htmlAssetCandidates.js"

describe("htmlAssetCandidates", () => {
  it("normalizeAssetPathname strips query and hash", () => {
    assert.equal(normalizeAssetPathname("/about?q=1#top"), "/about")
    assert.equal(normalizeAssetPathname("/"), "/")
  })

  it("normalizeAssetPathname preserves percent-encoded path segments", () => {
    assert.equal(
      normalizeAssetPathname("/blog/hello%20world"),
      "/blog/hello%20world"
    )
  })

  it("resolveHtmlAssetCandidates maps public paths to prerender pathnames", () => {
    assert.deepEqual(resolveHtmlAssetCandidates("/about"), [
      "/about",
      "/about.html",
      "/about/index.html",
    ])
    assert.deepEqual(resolveHtmlAssetCandidates("/posts/one"), [
      "/posts/one",
      "/posts/one.html",
      "/posts/one/index.html",
    ])
    assert.deepEqual(resolveHtmlAssetCandidates("/posts/one/"), [
      "/posts/one/index.html",
    ])
  })

  it("resolveHtmlAssetCandidates probes encoded and decoded dynamic segment paths", () => {
    assert.ok(
      resolveHtmlAssetCandidates("/blog/hello%20world").includes(
        "/blog/hello%20world.html"
      )
    )
    assert.ok(
      resolveHtmlAssetCandidates("/blog/hello world").includes(
        "/blog/hello%20world.html"
      )
    )
  })

  it("resolveHtmlAssetCandidates handles .html path and rejects other extensions", () => {
    assert.deepEqual(resolveHtmlAssetCandidates("/page.html"), ["/page.html"])
    assert.deepEqual(resolveHtmlAssetCandidates("/assets/app.js"), [])
  })

  it("maps candidates to disk paths like preview htmlCandidates", () => {
    const out = "/out"
    const files = resolveHtmlAssetCandidates("/about").map((candidate) =>
      path.join(out, candidate.replace(/^\/+/, ""))
    )
    assert.deepEqual(files, [
      path.join(out, "about"),
      path.join(out, "about.html"),
      path.join(out, "about", "index.html"),
    ])
  })

  it("inferNotFoundStrategy defaults from ssg and serverEntry", () => {
    assert.equal(inferNotFoundStrategy({ ssg: true }), "exact")
    assert.equal(
      inferNotFoundStrategy({ ssg: true, serverEntry: "./server.ts" }),
      "hybrid-ssr"
    )
    assert.equal(inferNotFoundStrategy({}), "exact")
  })
})
