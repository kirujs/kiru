import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { createElement } from "kiru"
import { renderToString } from "kiru"
import {
  buildModuleImportScope,
  isKiruJsxFactoryCall,
  registerImportDeclaration,
} from "./scope.js"
import {
  serializeJsxCallToHtml,
  serializeJsxCallToTemplate,
  type TemplateSerializeCtx,
} from "./templateHTML.js"
import { KIRU_HOLE_MARKER } from "kiru/utils"

type AstNode = import("./ast.js").AstNode

function buildCtx(source: string): TemplateSerializeCtx {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const bodyNodes = ast.body as AstNode[]
  const scope = buildModuleImportScope(bodyNodes)
  const resolve = (name: string) => scope.resolve(name)
  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") {
      registerImportDeclaration(node, scope)
    }
  }
  return {
    resolve,
    isJsxProd: (node) =>
      isKiruJsxFactoryCall(node, resolve, "jsx") ||
      isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxs: (node) => isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxDev: (node) => isKiruJsxFactoryCall(node, resolve, "jsxDEV"),
  }
}

function findOutermostJsxCall(
  source: string,
  ctx: TemplateSerializeCtx
): AstNode {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const calls: AstNode[] = []
  const visit = (node: AstNode) => {
    if (
      node.type === "CallExpression" &&
      (ctx.isJsxProd(node) || ctx.isJsxDev(node))
    ) {
      calls.push(node)
    }
    for (const key of Object.keys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key]
      if (Array.isArray(val)) {
        for (const c of val) {
          if (c && typeof c === "object" && "type" in c) {
            visit(c as AstNode)
          }
        }
      } else if (val && typeof val === "object" && "type" in val) {
        visit(val as AstNode)
      }
    }
  }
  for (const n of ast.body as AstNode[]) visit(n)
  if (calls.length === 0) throw new Error("no jsx call found")
  return calls.sort((a, b) => b.end - b.start - (a.end - a.start))[0]!
}

describe("templateHTML conformance vs renderToString", () => {
  it("static span matches renderToString", () => {
    const source = `
import { jsx } from "kiru/jsx-runtime"
const Badge = () => jsx("span", { className: "badge", children: "OK" })
`
    const ctx = buildCtx(source)
    const call = findOutermostJsxCall(source, ctx)
    const pluginHtml = serializeJsxCallToHtml(call, ctx)
    const runtimeHtml = renderToString(
      createElement("span", { className: "badge", children: "OK" })
    )
    assert.strictEqual(pluginHtml, runtimeHtml)
  })

  it("holed div shell template string includes marker", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"
const n = signal(0)
const el = jsxDEV("div", {
  children: [
    jsxDEV("span", { children: "A" }, void 0, false, void 0, void 0),
    jsxDEV("span", { children: n }, void 0, true, void 0, void 0),
  ],
}, void 0, true, void 0, void 0)
`
    const ctx = buildCtx(source)
    const call = findOutermostJsxCall(source, ctx)
    const result = serializeJsxCallToTemplate(call, ctx)
    assert.ok(result)
    assert.strictEqual(result!.holeCount, 1)
    assert.ok(result!.html.includes(KIRU_HOLE_MARKER))
    assert.ok(result!.html.includes("<span>A</span>"))
    const shellOnly = renderToString(
      createElement("div", {
        children: [createElement("span", { children: "A" })],
      })
    )
    assert.ok(shellOnly.startsWith("<div>"))
    assert.ok(result!.html.startsWith("<div>"))
  })
})
