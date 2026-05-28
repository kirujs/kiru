import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import {
  applyCodegenPlan,
  deferPlanToEdits,
  sliceNode,
  wrapDeferredExpr,
  type DeferPlan,
} from "./codegenPlan.js"
import { MagicString } from "./shared.js"
import * as AST from "./ast.js"

type AstNode = AST.AstNode

describe("codegenPlan", () => {
  it("applyCodegenPlan applies prepend then replaces end-to-start", () => {
    const source = "ab"
    const code = new MagicString(source)
    applyCodegenPlan(code, {
      edits: [
        { kind: "prepend", text: "!" },
        { kind: "replace", start: 1, end: 2, text: "B" },
      ],
      imports: {
        needTagStaticChildrenList: false,
        needRegionElement: false,
        needMarkHoisted: false,
      },
    })
    assert.equal(code.toString(), "!aB")
  })

  it("sliceNode uses defer virtual wrap text", () => {
    const source = "count()"
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const node = (ast as unknown as { body: AstNode[] }).body[0] as AstNode
    const expr = (node as { expression: AstNode }).expression
    const deferByNode = new Map([[expr, wrapDeferredExpr(source, expr)]])
    assert.equal(sliceNode(source, expr, deferByNode), "() => (count())")
  })

  it("deferPlanToEdits matches wrapDeferredExpr", () => {
    const source = "jsxs('div', { children: toggled() })"
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const call = (ast as unknown as { body: AstNode[] }).body[0] as AstNode
    const expr = (call as { expression: AstNode }).expression
    const args = (expr as { arguments: AstNode[] }).arguments
    const props = args[1]!
    const childrenProp = (
      (props as { properties: AstNode[] }).properties[0] as {
        value: AstNode
      }
    ).value
    const plan: DeferPlan = {
      wraps: [
        { node: childrenProp, text: wrapDeferredExpr(source, childrenProp) },
      ],
    }
    const code = new MagicString(source)
    applyCodegenPlan(code, {
      edits: deferPlanToEdits(plan),
      imports: {
        needTagStaticChildrenList: false,
        needRegionElement: false,
        needMarkHoisted: false,
      },
    })
    assert.match(code.toString(), /\(\) => \(toggled\(\)\)/)
  })

  it("composes exact-range replace + dynamicSlotWrap deterministically", () => {
    const source = "foo(bar)"
    const code = new MagicString(source)
    applyCodegenPlan(code, {
      edits: [
        { kind: "replace", start: 0, end: 8, text: "x" },
        {
          kind: "dynamicSlotWrap",
          start: 0,
          end: 8,
          regions: '[{kind:"insert",slot:0}]',
        },
      ],
      imports: {
        needTagStaticChildrenList: false,
        needRegionElement: true,
        needMarkHoisted: false,
      },
    })
    assert.equal(code.toString(), 'regionElement(x, [{kind:"insert",slot:0}])')
  })

  it("throws for partial overlap between replace and dynamicSlotWrap", () => {
    const source = "abcdef"
    const code = new MagicString(source)
    assert.throws(
      () =>
        applyCodegenPlan(code, {
          edits: [
            { kind: "replace", start: 1, end: 5, text: "X" },
            {
              kind: "dynamicSlotWrap",
              start: 0,
              end: 3,
              regions: '[{kind:"insert",slot:0}]',
            },
          ],
          imports: {
            needTagStaticChildrenList: false,
            needRegionElement: true,
            needMarkHoisted: false,
          },
        }),
      /dynamicSlotWrap overlaps replace/
    )
  })
})
