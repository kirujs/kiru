import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import type { AstNode } from "./ast.js"
import { buildProgramCallIndex } from "./programCallIndex.js"
import { blocksModuleHoist, blocksSetupHoist } from "./scope.js"

describe("buildProgramCallIndex", () => {
  it("records setup insert for render-root jsx", () => {
    const source = `
import { jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

const count = signal(0)

export function App() {
  return () => jsx("p", { children: count() })
}
`
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const index = buildProgramCallIndex(ast.body as AstNode[])

    let pSite: ReturnType<typeof index.getCall> | undefined
    index.forEachCall((site) => {
      const typeArg = site.node.arguments?.[0]
      if (typeArg?.type === "Literal" && typeArg.value === "p") {
        pSite = site
      }
    })
    assert.ok(pSite)
    assert.ok(pSite.setupInsertBefore)
    assert.strictEqual(pSite.setupInsertBefore?.type, "ReturnStatement")
    assert.strictEqual(blocksModuleHoist(pSite.resolve("count")), false)
  })

  it("snapshots render-local binding resolve at nested call sites", () => {
    const source = `
import { jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

export function App() {
  return () => {
    const local = signal(false)
    return jsx("p", { children: local() })
  }
}
`
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const index = buildProgramCallIndex(ast.body as AstNode[])

    let pSite: ReturnType<typeof index.getCall> | undefined
    index.forEachCall((site) => {
      const typeArg = site.node.arguments?.[0]
      if (typeArg?.type === "Literal" && typeArg.value === "p") {
        pSite = site
      }
    })
    assert.ok(pSite)
    assert.strictEqual(blocksModuleHoist(pSite.resolve("local")), true)
    assert.strictEqual(blocksSetupHoist(pSite.resolve("local")), true)
  })

  it("tracks module-scope $kN hoist inits", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
const $k0 = jsxDEV("span", { children: "OK" }, void 0, false, void 0, this)
`
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const index = buildProgramCallIndex(ast.body as AstNode[])
    const callStarts = new Set<number>()
    index.forEachCall((site) => callStarts.add(site.node.start))
    assert.equal(index.moduleHoistInits.size, 1)
    for (const start of index.moduleHoistInits) {
      assert.ok(callStarts.has(start))
    }
  })
})
