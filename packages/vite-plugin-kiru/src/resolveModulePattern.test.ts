import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdir, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  isGlobPattern,
  resolveModulePattern,
  resolveSingleModulePattern,
  sortSiteConfigPaths,
} from "./resolveModulePattern.js"

describe("resolveModulePattern", () => {
  it("detects glob magic", () => {
    assert.strictEqual(isGlobPattern("./src/site.config.{ts,js}"), true)
    assert.strictEqual(isGlobPattern("./src/routes.ts"), false)
  })

  it("resolves brace expansion to multiple files", async () => {
    const dir = join(tmpdir(), `kiru-glob-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    try {
      await writeFile(join(dir, "site.config.ts"), "export const site = {}", "utf8")
      await writeFile(join(dir, "site.config.js"), "export const site = {}", "utf8")
      const matches = await resolveModulePattern(
        "site.config.{ts,js}",
        dir,
        "test"
      )
      assert.strictEqual(matches.length, 2)
      assert.ok(matches.some((p) => p.endsWith("site.config.ts")))
      assert.ok(matches.some((p) => p.endsWith("site.config.js")))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it("resolveSingleModulePattern errors on multiple matches", async () => {
    const dir = join(tmpdir(), `kiru-glob-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    try {
      await writeFile(join(dir, "a.ts"), "", "utf8")
      await writeFile(join(dir, "b.ts"), "", "utf8")
      await assert.rejects(
        () => resolveSingleModulePattern("*.ts", dir, "test"),
        /matched multiple files/
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it("sortSiteConfigPaths prefers .ts over .js", () => {
    const sorted = sortSiteConfigPaths([
      "/app/site.config.js",
      "/app/site.config.ts",
    ])
    assert.ok(sorted[0]!.endsWith(".ts"))
  })
})
