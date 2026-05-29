import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import {
  loaderManifestPath,
  readLoaderModuleManifest,
  writeDevLoaderManifest,
} from "./loaderRegistryVirtual.js"

describe("loaderRegistryVirtual", () => {
  it("loaderManifestPath is under cacheDir", () => {
    const cacheDir = path.join(os.tmpdir(), "kiru-cache-a")
    assert.equal(
      loaderManifestPath(cacheDir),
      path.join(cacheDir, "kiru-loader-modules.json").replace(/\\/g, "/")
    )
  })

  it("write and read round-trip under cacheDir", async () => {
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiru-manifest-"))
    const modules = { r_abc123: "/src/pages/foo.tsx" }
    await writeDevLoaderManifest(cacheDir, modules)
    const read = await readLoaderModuleManifest({ cacheDir })
    assert.deepEqual(read, modules)
  })

  it("separate cacheDirs do not overwrite each other", async () => {
    const cacheA = await fs.mkdtemp(path.join(os.tmpdir(), "kiru-manifest-a-"))
    const cacheB = await fs.mkdtemp(path.join(os.tmpdir(), "kiru-manifest-b-"))
    await writeDevLoaderManifest(cacheA, { r_a: "/a.tsx" })
    await writeDevLoaderManifest(cacheB, { r_b: "/b.tsx" })
    const readA = await readLoaderModuleManifest({ cacheDir: cacheA })
    const readB = await readLoaderModuleManifest({ cacheDir: cacheB })
    assert.deepEqual(readA, { r_a: "/a.tsx" })
    assert.deepEqual(readB, { r_b: "/b.tsx" })
  })
})
