import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serveStaticFile } from "./serveStaticFile.js"

describe("serveStaticFile", () => {
  it("serves files under /assets and blocks path traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "kiru-static-"))
    try {
      await mkdir(join(root, "assets"), { recursive: true })
      await writeFile(join(root, "assets", "app.js"), "ok", "utf8")

      const ok = await serveStaticFile(root, "/assets/app.js")
      assert.ok(ok)
      assert.equal(await ok.text(), "ok")

      const blocked = await serveStaticFile(root, "/assets/../package.json")
      assert.equal(blocked, null)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("does not serve index.html for /", async () => {
    const root = await mkdtemp(join(tmpdir(), "kiru-static-"))
    try {
      await writeFile(join(root, "index.html"), "{{kiru_body}}", "utf8")
      assert.equal(await serveStaticFile(root, "/"), null)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
