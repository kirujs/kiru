import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { isKiruJsxFactoryCall } from "./scope.js"
import { buildProgramBindingResolve, walkProgramBody } from "./scopeWalk.js"
import {
  isTemplateEligibleCall,
  isTemplateShellEligibleCall,
  selectMaximalTemplateShellCalls,
  serializeJsxCallToHtml,
  serializeJsxCallToTemplate,
  shellHtmlHasStaticContent,
  type TemplateSerializeCtx,
} from "./templateHTML.js"

type AstNode = import("./ast.js").AstNode

function buildCtx(source: string): TemplateSerializeCtx {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const bodyNodes = ast.body as AstNode[]
  const resolve = buildProgramBindingResolve(bodyNodes)
  return {
    resolve,
    isJsxProd: (node) =>
      isKiruJsxFactoryCall(node, resolve, "jsx") ||
      isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxs: (node) => isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxDev: (node) => isKiruJsxFactoryCall(node, resolve, "jsxDEV"),
  }
}

function collectShellCallSites(source: string, ctx: TemplateSerializeCtx) {
  const body = parseAst(source, { allowReturnOutsideFunction: true }).body as AstNode[]
  const calls: { node: AstNode; strictHoledShell: boolean }[] = []
  walkProgramBody(body, {
    onCallExpression: (node, { fnDepth }) => {
      if (
        (ctx.isJsxProd(node) || ctx.isJsxDev(node)) &&
        isTemplateShellEligibleCall(node, ctx)
      ) {
        calls.push({ node, strictHoledShell: fnDepth >= 2 })
      }
    },
  })
  return calls
}

function findOutermostJsxCall(source: string, ctx: TemplateSerializeCtx): AstNode {
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

function findFirstJsxCall(source: string, ctx: TemplateSerializeCtx): AstNode {
  return findOutermostJsxCall(source, ctx)
}

describe("templateHTML", () => {
  it("serializes static span", () => {
    const source = `
import { jsx } from "kiru/jsx-runtime"
const Badge = () => jsx("span", { className: "badge", children: "OK" })
`
    const ctx = buildCtx(source)
    const call = findFirstJsxCall(source, ctx)
    assert.ok(isTemplateEligibleCall(call, ctx))
    assert.strictEqual(
      serializeJsxCallToHtml(call, ctx),
      '<span class="badge">OK</span>'
    )
  })

  it("inlines holed static wrapper div for children param", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
export default function Layout({ children }) {
  return jsxDEV("div", { className: "shell", children: [
    jsxDEV("div", { className: "outlet", children }, void 0, false, void 0, void 0),
  ] }, void 0, true, void 0, void 0)
}
`
    const ctx = buildCtx(source)
    const call = findFirstJsxCall(source, ctx)
    const result = serializeJsxCallToTemplate(call, ctx)
    assert.ok(result)
    assert.ok(result!.html.includes('class="outlet"'))
    assert.ok(result!.html.includes("<!--#-->"))
    assert.strictEqual(result!.holeCount, 1)
    assert.strictEqual(result!.holeNodes[0]?.type, "Identifier")
  })

  it("serializes mixed div shell with one hole", () => {
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
    const call = findFirstJsxCall(source, ctx)
    const result = serializeJsxCallToTemplate(call, ctx)
    assert.ok(result)
    assert.strictEqual(result!.holeCount, 1)
    assert.ok(result!.html.includes("<!--#-->"))
  })

  it("shellHtmlHasStaticContent detects inlined heading text", () => {
    assert.strictEqual(
      shellHtmlHasStaticContent('<div><h1>Title</h1><!--#--></div>'),
      true
    )
    assert.strictEqual(
      shellHtmlHasStaticContent("<div><!--#--><!--#--></div>"),
      false
    )
  })

  it("selectMaximalTemplateShellCalls keeps inner h1 when outer bind makes shell ineligible", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"
const n = signal(0)
export function Page() {
  return jsxDEV("div", { "bind:ref": n, children: [
    jsxDEV("h1", { children: "Title" }, void 0, false, void 0, void 0),
  ] }, void 0, true, void 0, void 0)
}
`
    const ctx = buildCtx(source)
    const selected = selectMaximalTemplateShellCalls(
      collectShellCallSites(source, ctx),
      ctx
    )
    assert.strictEqual(selected.length, 1)
    assert.ok(selected[0]!.result.html.includes("<h1>Title</h1>"))
    assert.strictEqual(selected[0]!.result.holeCount, 0)
  })

  it("groups contiguous jsx nav children into one region hole", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { Link } from "kiru/router"
export default function Layout() {
  return jsxDEV("nav", { children: [
    jsxDEV(Link, { to: "/", children: "Home" }, void 0, false, void 0, void 0),
    jsxDEV(Link, { to: "/about", children: "About" }, void 0, false, void 0, void 0),
  ] }, void 0, true, void 0, void 0)
}
`
    const ctx = buildCtx(source)
    const call = findFirstJsxCall(source, ctx)
    const result = serializeJsxCallToTemplate(call, ctx)
    assert.ok(result)
    assert.strictEqual(result!.holeCount, 1)
    assert.strictEqual(result!.holeNodes.length, 1)
    assert.strictEqual(result!.holeNodes[0]?.type, "ArrayExpression")
    const markerCount = (result!.html.match(/<!--#-->/g) ?? []).length
    assert.strictEqual(markerCount, 1)
    assert.strictEqual(result!.regions[0]?.kind, "fragment")
  })

  it("classifies conditional children as conditional regions", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
export function Page({ ok }) {
  return jsxDEV("div", { children: ok ? jsxDEV("p", { children: "yes" }, void 0, false, void 0, void 0) : jsxDEV("p", { children: "no" }, void 0, false, void 0, void 0) }, void 0, false, void 0, void 0)
}
`
    const ctx = buildCtx(source)
    const call = findFirstJsxCall(source, ctx)
    const result = serializeJsxCallToTemplate(call, ctx)
    assert.ok(result)
    assert.strictEqual(result!.holeCount, 1)
    assert.strictEqual(result!.regions[0]?.kind, "conditional")
  })

  it("classifies reactive text children as text regions", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"
const guardEvents = signal([])
export function Page() {
  return jsxDEV("p", { children: ["Guard: ", () => guardEvents().join(", ")] }, void 0, true, void 0, void 0)
}
`
    const ctx = buildCtx(source)
    const call = findFirstJsxCall(source, ctx)
    const result = serializeJsxCallToTemplate(call, ctx)
    assert.ok(result)
    assert.strictEqual(result!.holeCount, 1)
    assert.strictEqual(result!.regions[0]?.kind, "text")
  })

  it("uses innerHTML instead of children when both are present", () => {
    const source = `
import { jsx } from "kiru/jsx-runtime"
const el = jsx("div", {
  innerHTML: "Hello world!",
  children: jsx("h1", { children: "ignored" }),
})
`
    const ctx = buildCtx(source)
    const call = findFirstJsxCall(source, ctx)
    assert.ok(isTemplateEligibleCall(call, ctx))
    assert.strictEqual(
      serializeJsxCallToHtml(call, ctx),
      "<div>Hello world!</div>"
    )
  })

  it("innerHTML signal becomes a single template hole and ignores children", () => {
    const source = `
import { jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"
const text = signal("Hello world!")
const el = jsx("div", {
  innerHTML: text,
  children: jsx("h1", { children: "ignored" }),
})
`
    const ctx = buildCtx(source)
    const call = findFirstJsxCall(source, ctx)
    const result = serializeJsxCallToTemplate(call, ctx)
    assert.ok(result)
    assert.strictEqual(result!.holeCount, 1)
    assert.strictEqual(result!.holeNodes[0]?.type, "Identifier")
    assert.ok(result!.html.includes("<!--#-->"))
    assert.ok(!result!.html.includes("<h1>"))
  })

  it("rejects bind: props", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"
const count = signal(0)
const Input = () => jsxDEV("input", { bind: { value: count } }, void 0, false, void 0, void 0)
`
    const ctx = buildCtx(source)
    const call = findFirstJsxCall(source, ctx)
    assert.equal(isTemplateEligibleCall(call, ctx), false)
  })
})
