import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  prerenderedHtmlCandidates,
  tryReadPrerenderedHtml,
} from "../../router/prerenderedHtml.js"

describe("prerenderedHtml", () => {
  it("prerenderedHtmlCandidates prefers .html first when trailingSlash is never", () => {
    const candidates = prerenderedHtmlCandidates("/dist", "/about", {
      trailingSlash: "never",
    })
    assert.ok(candidates[0]?.includes("about.html"))
    assert.ok(
      candidates.some((c) => c.includes("about") && c.includes("index.html"))
    )
  })

  it("prerenderedHtmlCandidates prefers index.html first when trailingSlash is always", () => {
    const candidates = prerenderedHtmlCandidates("/dist", "/about/", {
      trailingSlash: "always",
    })
    assert.ok(candidates[0]?.includes("index.html"))
    assert.ok(candidates[0]?.includes("about"))
  })

  it("tryReadPrerenderedHtml ignores Vite index.html shell when staticPaths is empty", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kiru-prerender-"))
    try {
      await writeFile(
        join(dir, "index.html"),
        "<html>{{kiru_body}}</html>",
        "utf8"
      )
      assert.strictEqual(
        tryReadPrerenderedHtml(dir, "/", { staticPaths: new Set() }),
        null
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it("tryReadPrerenderedHtml respects staticPaths gate", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kiru-prerender-"))
    try {
      await writeFile(join(dir, "about.html"), "<html>about</html>", "utf8")
      assert.strictEqual(
        tryReadPrerenderedHtml(dir, "/about", {
          staticPaths: new Set(["/missing"]),
        }),
        null
      )
      assert.strictEqual(
        tryReadPrerenderedHtml(dir, "/about", {
          staticPaths: new Set(["/about"]),
        }),
        "<html>about</html>"
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it("tryReadPrerenderedHtml matches paths with trailing slash policy", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kiru-prerender-"))
    try {
      await mkdir(join(dir, "about"), { recursive: true })
      await writeFile(
        join(dir, "about", "index.html"),
        "<html>about-index</html>",
        "utf8"
      )
      const html = tryReadPrerenderedHtml(dir, "/about/", {
        staticPaths: new Set(["/about/"]),
        pathPolicy: { trailingSlash: "always" },
      })
      assert.strictEqual(html, "<html>about-index</html>")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
