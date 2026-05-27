import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import {
  getCompileRegionsForJsxs,
  type RegionAnalysisCtx,
} from "./compileRegions.js"
import { buildProgramBindingResolve } from "./scopeWalk.js"
import { isKiruJsxFactoryCall } from "./scope.js"
import * as AST from "./ast.js"

type AstNode = AST.AstNode

function buildCtx(source: string): RegionAnalysisCtx {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const resolve = buildProgramBindingResolve(ast.body as AstNode[])
  return {
    resolve,
    isJsxProd: (node) =>
      isKiruJsxFactoryCall(node, resolve, "jsx") ||
      isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxs: (node) => isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxDev: (node) => isKiruJsxFactoryCall(node, resolve, "jsxDEV"),
  }
}

function findJsxsDiv(source: string, ctx: RegionAnalysisCtx): AstNode {
  let found: AstNode | null = null
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  AST.walk(ast, {
    CallExpression: (node) => {
      if (found) return
      if (!ctx.isJsxs(node) && !ctx.isJsxDev(node)) return
      const typeArg = node.arguments?.[0]
      if (typeArg?.type === "Literal" && typeArg.value === "div") {
        found = node
      }
    },
  })
  assert.ok(found, "expected jsxs/jsxDEV div call")
  return found!
}

describe("compileRegions", () => {
  it("classifies arrow-wrapped logical child as conditional", () => {
    const source = `
import { jsx, jsxs } from "kiru/jsx-runtime"
import { signal } from "kiru"

const Toggler = () => {
  const toggled = signal(false)
  return () => jsxs("div", { children: [
    jsx("button", { onclick: () => toggled.set((t) => !t), children: "Toggle" }),
    () => toggled() && jsx("p", { children: "Toggled" }),
  ] })
}
`
    const ctx = buildCtx(source)
    const call = findJsxsDiv(source, ctx)
    const regions = getCompileRegionsForJsxs(call, ctx)
    assert.ok(regions)
    assert.strictEqual(regions!.length, 1)
    assert.strictEqual(regions![0]!.kind, "conditional")
    assert.strictEqual(regions![0]!.slot, 1)
  })

  it("classifies bare logical child as conditional", () => {
    const source = `
import { jsxs, jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

const Toggler = () => {
  const toggled = signal(false)
  return () => jsxs("div", { children: [
    jsx("button", { children: "Toggle" }),
    toggled() && jsx("p", { children: "Toggled" }),
  ] })
}
`
    const ctx = buildCtx(source)
    const call = findJsxsDiv(source, ctx)
    const regions = getCompileRegionsForJsxs(call, ctx)
    assert.ok(regions)
    assert.strictEqual(regions![0]!.kind, "conditional")
  })
})
