import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { createDomSerializeCtx } from "./context.js"
import { findDomCompileUnits } from "./findUnits.js"
import { serializeJsxCallToTemplate } from "../templateHTML.js"

describe("jsxDEV serialize", () => {
  it("serializes minimal jsxDEV div", () => {
    const ast = parseAst(
      `import { jsxDEV } from "kiru/jsx-dev-runtime";
function f() {
  return jsxDEV("div", { class: "x", children: 1 }, void 0, false, {}, void 0);
}`,
      { allowReturnOutsideFunction: true }
    )
    const ctx = createDomSerializeCtx(ast)
    const fn = ast.body[1] as { body: { body: { argument: unknown }[] } }
    const jsxRoot = fn.body.body[0]!.argument
    const result = serializeJsxCallToTemplate(jsxRoot as never, ctx)
    assert.ok(result, "expected serialize result")
  })

  it("serializes jsxDEV with dynamic data-testid only", () => {
    const ast = parseAst(
      `import { jsxDEV } from "kiru/jsx-dev-runtime";
function CounterBody(props) {
  const testId = props.testId || "counter";
  return () =>
    jsxDEV("div", {
      class: "counter-item",
      "data-testid": testId,
      children: "0",
    }, void 0, false, {}, void 0);
}`,
      { allowReturnOutsideFunction: true }
    )
    const ctx = createDomSerializeCtx(ast)
    const units = findDomCompileUnits(ctx.bodyNodes, ctx)
    const result = serializeJsxCallToTemplate(units[0]!.jsxRoot as never, ctx)
    assert.ok(result, "expected serialize result")
  })

  it("serializes jsxDEV with dynamic text child only", () => {
    const ast = parseAst(
      `import { jsxDEV } from "kiru/jsx-dev-runtime";
function CounterBody() {
  const count = () => 0;
  return () =>
    jsxDEV("div", {
      class: "counter-item",
      children: count(),
    }, void 0, false, {}, void 0);
}`,
      { allowReturnOutsideFunction: true }
    )
    const ctx = createDomSerializeCtx(ast)
    const units = findDomCompileUnits(ctx.bodyNodes, ctx)
    const result = serializeJsxCallToTemplate(units[0]!.jsxRoot as never, ctx)
    assert.ok(result, "expected serialize result")
  })
})
