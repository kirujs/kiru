import { describe, it } from "node:test"
import assert from "node:assert"
import { MagicString } from "../shared.js"
import { parseAst } from "rollup/parseAst"
import { classifyTemplateHoleRegion } from "../compileRegions.js"
import { createDomSerializeCtx } from "./context.js"
import { findDomCompileUnits } from "./findUnits.js"
import { applyDomCodegen } from "./index.js"

function transformDom(source: string): string {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const code = new MagicString(source)
  applyDomCodegen({
    code,
    ast,
    isBuild: false,
    fileLinkFormatter: (id: string) => id,
    filePath: "/project/src/counter.tsx",
    log: () => {},
  })
  return code.toString()
}

describe("counter emit debug", () => {
  it("classifies count() as text hole", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime";
import { signal } from "kiru/dom";
function CounterBody() {
  const count = signal(0);
  return () =>
    jsxDEV("span", { class: "counter-value", children: count() }, void 0, false, {}, void 0);
}`
    const ast = parseAst(source, { allowReturnOutsideFunction: true })
    const ctx = createDomSerializeCtx(ast)
    assert.equal(ctx.resolve("count")?.kind, "setupConst")
    const units = findDomCompileUnits(ctx.bodyNodes, ctx)
    const span = units[0]!.jsxRoot
    const props = span.arguments?.[1] as { properties?: AstNode[] }
    const childProp = props?.properties?.find(
      (p) => p.type === "Property" && (p.key as { name?: string })?.name === "children"
    )
    const countCall = (childProp as { value: unknown })?.value
    assert.equal((countCall as { type?: string })?.type, "CallExpression")
    const region = classifyTemplateHoleRegion(countCall as never, ctx, 0)
    assert.equal(region.kind, "text")
  })

  it("emits insertText for signal text child", () => {
    const out = transformDom(`
"use dom";
import { jsxDEV } from "kiru/jsx-dev-runtime";
import { signal, createComponent } from "kiru/dom";

function CounterBody(props) {
  const count = signal(props.initial || 0);
  const testId = props.testId || "counter";
  return () =>
    jsxDEV("div", {
      class: "counter-item",
      "data-testid": testId,
      children: [
        jsxDEV("span", { class: "counter-value", children: count() }, void 0, false, {}, void 0),
        jsxDEV("button", {
          class: "increment",
          type: "button",
          "data-testid": "increment",
          onclick: () => count.set((c) => c + 1),
          children: "+",
        }, void 0, false, {}, void 0),
      ],
    }, void 0, true, {}, void 0);
}
`)
    assert.match(out, /insertText\(/, out)
  })
})
