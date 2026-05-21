import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldRegenerateFileRoutes } from "./fileRoutesDev.js"
import type { ResolvedFileRoutes } from "./fileRoutesConfig.js"

const fr: ResolvedFileRoutes = {
  pagesDir: "./src/pages",
  pagesDirAbs: "/app/src/pages",
  outFile: "./src/routes.gen.ts",
  outFileAbs: "/app/src/routes.gen.ts",
  pageFiles: ["page.tsx"],
  extend: "./src/routes.extend.ts",
  extendAbs: "/app/src/routes.extend.ts",
}

describe("shouldRegenerateFileRoutes", () => {
  it("matches files under pagesDir", () => {
    assert.equal(
      shouldRegenerateFileRoutes("/app/src/pages/about/page.tsx", fr),
      true
    )
  })

  it("matches extend module path", () => {
    assert.equal(
      shouldRegenerateFileRoutes("/app/src/routes.extend.ts", fr),
      true
    )
  })

  it("ignores unrelated project files", () => {
    assert.equal(shouldRegenerateFileRoutes("/app/src/components/Foo.tsx", fr), false)
    assert.equal(shouldRegenerateFileRoutes("/app/src/main.tsx", fr), false)
  })
})
