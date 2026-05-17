import { describe, it } from "node:test"
import assert from "node:assert"
import path from "node:path"
import { normalizeModulePath } from "./utils.js"

describe("normalizeModulePath", () => {
  const projectRoot = path
    .resolve("/repos/kiru/kiru/e2e/ssr")
    .replace(/\\/g, "/")

  it("maps Vite root-absolute ids into the project root", () => {
    const resolved = normalizeModulePath(
      "/src/pages/index.actions.ts",
      projectRoot
    )
    assert.strictEqual(
      resolved,
      `${projectRoot}/src/pages/index.actions.ts`
    )
  })

  it("preserves absolute paths already under the project root", () => {
    const absolute = `${projectRoot}/src/pages/index.actions.ts`
    assert.strictEqual(
      normalizeModulePath(absolute, projectRoot),
      absolute
    )
  })
})
