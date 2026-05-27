import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "./shared.js"
import { applyJsxHoistAndTemplates } from "./jsxHoistPipeline.js"
import { prepareDeferSlotReads } from "./deferSlotReads.js"

function transformDefer(source: string): string {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const ctx = {
    code: new MagicString(source),
    ast,
    isBuild: false,
    fileLinkFormatter: (id: string) => id,
    filePath: "/project/src/toggler.tsx",
    log: () => {},
  }
  prepareDeferSlotReads(ctx)
  return ctx.code.toString()
}

describe("prepareDeferSlotReads", () => {
  it("wraps logical slot with signal call but not mixed text arrays", () => {
    const out = transformDefer(`
import { jsx, jsxs } from "kiru/jsx-runtime"
import { signal } from "kiru"

const Toggler = () => {
  const toggled = signal(false)
  return () => jsxs("div", { children: [
    jsx("button", { children: "Toggle" }),
    toggled() && jsx("p", { children: "Toggled" }),
  ] })
}
`)
    assert.match(out, /\(\) => \(toggled\(\) && jsx\("p"/)
    assert.doesNotMatch(out, /\(\) => \(count\)/)
  })

  it("does not double-wrap existing inline fn children", () => {
    const out = transformDefer(`
import { jsxs } from "kiru/jsx-runtime"
import { signal } from "kiru"
const Toggler = () => {
  const toggled = signal(false)
  return () => jsxs("div", { children: [() => toggled() && null] })
}
`)
    assert.match(out, /\(\) => toggled\(\) && null/)
    assert.doesNotMatch(out, /\(\) => \(\(\) =>/)
  })
})
