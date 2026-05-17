import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "./shared.js"
import { preparePageLoaders } from "./loaders.js"

function transformClientLoaderExport(source: string): string {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const code = new MagicString(source)
  preparePageLoaders(
    {
      code,
      ast,
      isBuild: false,
      fileLinkFormatter: (id) => id,
      filePath: "/project/src/pages/example.tsx",
      log: () => {},
    },
    "/project",
    false
  )
  return code.toString()
}

describe("preparePageLoaders (client)", () => {
  it("stubs function-form serverLoader", () => {
    const out = transformClientLoaderExport(`
import { serverLoader } from "kiru/router"
export const load = serverLoader(async (ctx) => ({ ok: ctx.url.pathname }))
export default function Page() { return null }
`)
    assert.match(out, /__kiruLoader: "server"/)
    assert.match(out, /__\$loadDispatch\(\)/)
    assert.doesNotMatch(out, /async \(ctx\)/)
  })

  it("stubs object-form serverLoader and preserves fallback", () => {
    const out = transformClientLoaderExport(`
import { serverLoader } from "kiru/router"
export const load = serverLoader({
  load: async (ctx) => ({ ok: ctx.url.pathname }),
  fallback: () => null,
})
export default function Page() { return null }
`)
    assert.match(out, /__kiruLoader: "server"/)
    assert.match(out, /__kiruFallback: \(\) => null/)
    assert.doesNotMatch(out, /load: async/)
  })

})
