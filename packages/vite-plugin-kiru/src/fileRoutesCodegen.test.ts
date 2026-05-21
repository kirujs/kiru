import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import assert from "node:assert"
import { promises as fs } from "node:fs"
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
        pageFiles: ["page.{tsx,ts,jsx,js}", "index.{tsx,ts,jsx,js}"],
      })
      assert.strictEqual(written, true)
      assert.strictEqual(outFileAbs, outFile)
      const source = await fs.readFile(outFile, "utf8")
      assert.ok(source.includes("/guarded"))
      assert.ok(source.includes("createRouteTree"))
      assert.ok(source.includes("guarded/middleware"))
    } finally {
      await fs.unlink(outFile).catch(() => {})
    }
  })
})
