import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import assert from "node:assert"
import { promises as fs } from "node:fs"
import {
  DEFAULT_ERROR_FILES,
  DEFAULT_LAYOUT_FILES,
  DEFAULT_NOT_FOUND_FILES,
  DEFAULT_PAGE_FILES,
} from "@kirujs/file-routes"
import { writeGeneratedRoutes } from "./fileRoutesCodegen.js"

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../file-routes/fixtures/basic"
)

describe("writeGeneratedRoutes", () => {
  it("writes routes.gen.ts from pages directory", async () => {
    const outFile = path.join(fixtures, "_tmp.routes.gen.ts")
    try {
      const { written, outFileAbs } = await writeGeneratedRoutes({
        pagesDir: path.join(fixtures, "pages"),
        pagesDirAbs: path.join(fixtures, "pages"),
        outFile: "./_tmp.routes.gen.ts",
        outFileAbs: outFile,
        pageFiles: [...DEFAULT_PAGE_FILES],
        layoutFiles: [...DEFAULT_LAYOUT_FILES],
        errorFiles: [...DEFAULT_ERROR_FILES],
        notFoundFiles: [...DEFAULT_NOT_FOUND_FILES],
      })
      assert.strictEqual(written, true)
      assert.strictEqual(outFileAbs, outFile)
      const source = await fs.readFile(outFile, "utf8")
      assert.ok(source.includes("/guarded"))
      assert.ok(source.includes("createRouteTree"))
      assert.ok(source.includes("guarded/scope.config"))
    } finally {
      await fs.unlink(outFile).catch(() => {})
    }
  })
})
