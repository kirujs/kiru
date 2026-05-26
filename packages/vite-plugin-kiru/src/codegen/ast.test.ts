import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { type AstNode, walk } from "./ast.js"

describe("AST.walk", () => {
  it("exposes parent and grandparent from the ancestor stack", () => {
    const source = `jsx("div", { children: "x" })`
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const expr = (ast as { body: AstNode[] }).body[0] as AstNode
    const seen: string[] = []
    walk(expr, {
      Literal: (node, ctx) => {
        if (node.value !== "x") return
        seen.push(ctx.parent()?.type ?? "null")
        seen.push(ctx.grandparent()?.type ?? "null")
      },
    })
    assert.deepStrictEqual(seen, ["Property", "ObjectExpression"])
  })

  it("walkArguments descends only into call arguments", () => {
    const source = `foo(jsx("a", {}), 1)`
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const expr = (ast as { body: AstNode[] }).body[0] as AstNode
    const types: string[] = []
    walk(expr, {
      CallExpression: (node, ctx) => {
        if (node.callee?.type !== "Identifier" || node.callee.name !== "foo") {
          return
        }
        types.push(node.type)
        ctx.walkArguments(node)
        ctx.skipDescent()
      },
      "*": (node) => {
        types.push(node.type)
      },
    })
    assert.ok(types.includes("CallExpression"))
    assert.ok(types.includes("Literal"))
    assert.ok(!types.includes("MemberExpression"))
  })
})
