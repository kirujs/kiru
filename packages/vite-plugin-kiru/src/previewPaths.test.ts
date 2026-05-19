import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import type { ResolvedConfig } from "vite"
import type { PluginState } from "./config.js"
import {
  previewServerBundleExists,
  resolvePreviewClientDir,
  resolvePreviewServerEntry,
} from "./previewPaths.js"

function fakeConfig(root: string, outDir: string): ResolvedConfig {
  return { root, build: { outDir } } as ResolvedConfig
}

function fakeState(partial: Partial<PluginState["router"]>): PluginState {
  return {
    outDir: "dist",
    baseOutDir: "dist",
    router: {
      ssg: null,
      serverEntry: null,
      serverEntryAbs: null,
      remote: null,
      adapter: "node",
      ...partial,
    },
  } as PluginState
}

describe("previewPaths", () => {
  it("resolvePreviewClientDir prefers dist/client when SSR serverEntry is set", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiru-preview-paths-"))
    fs.mkdirSync(path.join(root, "dist", "client"), { recursive: true })
    fs.writeFileSync(path.join(root, "dist", "client", "index.html"), "x")

    const dir = resolvePreviewClientDir(
      fakeConfig(root, "dist"),
      fakeState({ serverEntry: "./src/server.ts" })
    )
    assert.equal(dir, path.join(root, "dist", "client"))
  })

  it("resolvePreviewClientDir uses configured outDir for pure SSG", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiru-preview-paths-"))
    fs.mkdirSync(path.join(root, "dist"), { recursive: true })

    const dir = resolvePreviewClientDir(
      fakeConfig(root, "dist"),
      fakeState({ ssg: { routesModule: "./src/routes.ts" } as any })
    )
    assert.equal(dir, path.join(root, "dist"))
  })

  it("resolvePreviewServerEntry and previewServerBundleExists", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiru-preview-paths-"))
    const client = path.join(root, "dist", "client")
    const serverDir = path.join(root, "dist", "server")
    fs.mkdirSync(client, { recursive: true })
    fs.mkdirSync(serverDir, { recursive: true })
    fs.writeFileSync(path.join(serverDir, "index.js"), "export default {}")
    assert.equal(
      resolvePreviewServerEntry(client),
      path.join(serverDir, "index.js")
    )
    assert.equal(previewServerBundleExists(client), true)
  })
})
