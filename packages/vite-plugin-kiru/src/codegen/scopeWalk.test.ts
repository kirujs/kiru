import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import type { AstNode } from "./ast.js"
import { walkProgramBody } from "./scopeWalk.js"

describe("walkProgramBody", () => {
  it("parses export function with block body", () => {
    const ast = parseAst(`export function Page() { return jsxs("div", {}) }`, {
      allowReturnOutsideFunction: true,
    })
    const exp = (ast as { body: AstNode[] }).body[0]!
    assert.strictEqual(exp.type, "ExportNamedDeclaration")
    assert.strictEqual(exp.declaration?.type, "FunctionDeclaration")
    assert.strictEqual(exp.declaration?.body?.type, "BlockStatement")
  })

  it("visits top-level expression statement calls", () => {
    const source = `
import { jsxs } from "kiru/jsx-runtime"
jsxs("div", {})
`
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const tags: string[] = []
    walkProgramBody(ast.body as AstNode[], {
      onCallExpression: (node) => {
        const typeArg = node.arguments?.[0]
        if (typeArg?.type === "Literal" && typeof typeArg.value === "string") {
          tags.push(typeArg.value)
        }
      },
    })
    assert.deepStrictEqual(tags, ["div"])
  })

  it("visits jsx inside a bare function declaration", () => {
    const source = `
import { jsxs } from "kiru/jsx-runtime"
function Page() {
  return jsxs("div", { children: [] })
}
`
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const tags: string[] = []
    walkProgramBody(ast.body as AstNode[], {
      onCallExpression: (node) => {
        const typeArg = node.arguments?.[0]
        if (typeArg?.type === "Literal" && typeof typeArg.value === "string") {
          tags.push(typeArg.value)
        }
      },
    })
    assert.deepStrictEqual(tags, ["div"])
  })

  it("visits jsx factory calls inside export function bodies", () => {
    const source = `
import { jsxs, jsx } from "kiru/jsx-runtime"
export function Page() {
  return jsxs("div", {
    children: [jsx("span", { children: "a" })],
  })
}
`
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const tags: string[] = []
    walkProgramBody(ast.body as AstNode[], {
      onCallExpression: (node) => {
        const typeArg = node.arguments?.[0]
        if (typeArg?.type === "Literal" && typeof typeArg.value === "string") {
          tags.push(typeArg.value)
        }
      },
    })
    assert.deepStrictEqual(tags, ["div", "span"])
  })
})
