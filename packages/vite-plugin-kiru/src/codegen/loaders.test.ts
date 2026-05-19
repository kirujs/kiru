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

  it("stubs staticLoader for SSG client builds", () => {
    const ast = parseAst(
      `
import { staticLoader } from "kiru/router"
export const load = staticLoader(async () => ({ ok: true }))
export default function Page() { return null }
`,
      { allowReturnOutsideFunction: true }
    )
    const code = new MagicString(
      `import { staticLoader } from "kiru/router"\nexport const load = staticLoader(async () => ({ ok: true }))\nexport default function Page() { return null }\n`
    )
    preparePageLoaders(
      {
        code,
        ast,
        isBuild: true,
        fileLinkFormatter: (id) => id,
        filePath: "/project/src/pages/static.tsx",
        log: () => {},
      },
      "/project",
      false,
      undefined,
      {
        staticLoaderClient: true,
        staticLoaderPayload: { "/loaders/static": { ok: true } },
      }
    )
    const out = code.toString()
    assert.match(out, /__kiruStaticLoaderPayload/)
    assert.match(out, /__kiruLoader: "static"/)
    assert.match(out, /ctx\.url\.pathname \+ ctx\.url\.search/)
    assert.doesNotMatch(out, /async \(\) =>/)
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
