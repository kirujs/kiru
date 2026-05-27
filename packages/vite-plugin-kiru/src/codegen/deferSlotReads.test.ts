import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import type { AstNode } from "./ast.js"
import { MagicString } from "./shared.js"
import { analyzeDeferSlotReads, prepareDeferSlotReads } from "./deferSlotReads.js"
import { buildProgramCallIndex, programResolve } from "./programCallIndex.js"

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

  it("supports per-call snapshot resolve via shared ProgramCallIndex", () => {
    const source = `
import { jsx, jsxs } from "kiru/jsx-runtime"
import { signal } from "kiru"

export function App() {
  return () => {
    const toggled = signal(false)
    return jsxs("div", { children: [
      jsx("button", { children: "Toggle" }),
      toggled() && jsx("p", { children: "Toggled" }),
    ] })
  }
}
`
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const callIndex = buildProgramCallIndex(ast.body as AstNode[])
    const plan = analyzeDeferSlotReads(
      ast,
      source,
      programResolve(callIndex),
      callIndex
    )
    const wrapped = plan.wraps.map((w) => w.text).join("\n")
    assert.match(wrapped, /\(\) => \(toggled\(\) && jsx\("p"/)
  })
})
