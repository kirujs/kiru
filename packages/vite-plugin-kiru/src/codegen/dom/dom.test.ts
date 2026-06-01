import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "../shared.js"
import { hasUseDomPragma, stripUseDomPragma } from "../domPragma.js"
import { applyDomCodegen } from "./index.js"

function transformDom(source: string): string {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const code = new MagicString(source)
  const ctx = {
    code,
    ast,
    isBuild: false,
    fileLinkFormatter: (id: string) => id,
    filePath: "/project/src/counter.tsx",
    log: () => {},
  }
  applyDomCodegen(ctx)
  return ctx.code.toString()
}

describe("dom codegen pragma", () => {
  it("detects use dom as first statement", () => {
    const ast = parseAst(`"use dom";\nexport const x = 1`, {
      allowReturnOutsideFunction: true,
    })
    assert.strictEqual(hasUseDomPragma(ast), true)
  })

  it("detects use dom after HMR prologue", () => {
    const ast = parseAst(
      `import x from "y";\nif (import.meta.hot) {}\n"use dom";\nexport const x = 1`,
      { allowReturnOutsideFunction: true }
    )
    assert.strictEqual(hasUseDomPragma(ast), true)
  })
})

describe("dom codegen counter", () => {
  it("compiles flat component to kiru/dom imperative emit", () => {
    const out = transformDom(`
"use dom";
import { jsx, jsxs } from "kiru/jsx-runtime";
import { signal, createComponent } from "kiru/dom";

function CounterBody(props) {
  const count = signal(props.initial || 0);
  return () =>
    jsxs("div", {
      className: "counter-item",
      children: [
        jsx("span", { className: "counter-value", children: count() }),
        jsx("button", {
          className: "increment",
          onclick: () => count.set((c) => c + 1),
          children: "+",
        }),
      ],
    });
}

export function createCounter(props) {
  return createComponent(CounterBody, props);
}
`)
    assert.match(out, /from "kiru\/dom"/)
    assert.match(out, /const \$t0 = template\(`/)
    assert.match(out, /clone\(\$t0\)/)
    assert.match(out, /project\(\$t0/)
    assert.match(out, /insertText\(/)
    assert.doesNotMatch(out, /\bjsx\(/)
    assert.doesNotMatch(out, /"use dom"/)
    assert.match(out, /return \(\) => (__renderRoot\$el\d+|\$el\d+)/)
    const cloneCount = (out.match(/clone\(\$t0\)/g) ?? []).length
    assert.strictEqual(cloneCount, 1)
  })

  it("hoists template setup for () => (props) => jsx shape", () => {
    const out = transformDom(`
"use dom";
import { jsx } from "kiru/jsx-runtime";
import { setupDom } from "kiru/dom";

function SectionColumn() {
  const { derive } = setupDom();
  const canMove = derive((p) => p.sectionId > 1);
  return (props) =>
    jsx("div", {
      className: "section-column",
      children: props.sectionName,
    });
}
`)
    assert.match(
      out,
      /return \(props\) => \{[\s\S]*let __renderRoot\$el\d+;[\s\S]*if \(!__renderRoot\$el\d+\) \{[\s\S]*clone\(\$t0\)/
    )
    assert.match(out, /insertText\([\s\S]*setupDom\(\)\.props\.sectionName/)
    assert.strictEqual((out.match(/clone\(\$t0\)/g) ?? []).length, 1)
    assert.doesNotMatch(out, /\bjsx\(/)
  })

  it("compiles production jsxs/jsx emit", () => {
    const out = transformDom(`
"use dom";
import { jsxs, jsx } from "kiru/jsx-runtime";
import { signal, createComponent } from "kiru/dom";

function CounterBody(props) {
  const count = signal(props.initial || 0);
  const testId = props.testId || "counter";
  return () =>
    jsxs("div", {
      class: "counter-item",
      "data-testid": testId,
      children: [
        jsx("span", { class: "counter-value", children: count() }),
        jsx("button", {
          class: "increment",
          onclick: () => count.set((c) => c + 1),
          children: "+",
        }),
      ],
    });
}
`)
    assert.match(out, /const \$t0 = template\(`/)
    assert.doesNotMatch(out, /\bjsx\(/)
  })

  it("compiles jsxDEV dev emit with dynamic testId", () => {
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
      children: count(),
    }, void 0, false, {}, void 0);
}
`)
    assert.match(out, /insertText\(/)
    assert.doesNotMatch(out, /\bjsxDEV\(/)
  })
})
