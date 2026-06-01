import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "../shared.js"
import { applyDomCodegen } from "./index.js"

function transformDom(source: string): string {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const code = new MagicString(source)
  const ctx = {
    code,
    ast,
    isBuild: false,
    fileLinkFormatter: (id: string) => id,
    filePath: "/project/src/app.tsx",
    log: () => {},
  }
  applyDomCodegen(ctx)
  return ctx.code.toString()
}

describe("dom codegen mount callback", () => {
  it("compiles mount(() => <Counter />, container) to createComponent getRoot", () => {
    const out = transformDom(`
"use dom";
import { jsx } from "kiru/jsx-runtime";
import { mount, signal } from "kiru/dom";

function Counter(props) {
  const count = signal(props.initial || 0);
  return () => jsx("div", { children: count() });
}

export function mountCounter(container) {
  return mount(() => jsx(Counter, {}), container);
}
`)
    assert.match(out, /mount\(\(\) => createComponent\(Counter, \{\}\)\.getRoot\(\), container\)/)
    assert.match(out, /createComponent \} from "kiru\/dom"/)
  })

  it("compiles mount inline setup + render arrow", () => {
    const out = transformDom(`
"use dom";
import { jsx } from "kiru/jsx-runtime";
import { mount, signal } from "kiru/dom";

export function mountInline(container) {
  return mount(() => {
    const n = signal(0);
    return () => jsx("button", { onclick: () => n.set((c) => c + 1), children: n() });
  }, container);
}
`)
    assert.match(out, /const \$t0 = template\(`/)
    assert.match(out, /clone\(\$t0\)/)
    assert.match(out, /return (__renderRoot\$el0|\$el0)/)
    assert.doesNotMatch(out, /\bjsx\(/)
  })

  it("compiles mount(() => <div>flat</div>, container)", () => {
    const out = transformDom(`
"use dom";
import { jsx } from "kiru/jsx-runtime";
import { mount } from "kiru/dom";

export function mountFlat(container) {
  return mount(() => jsx("div", { children: "flat" }), container);
}
`)
    assert.match(out, /mount\(\(\) => \{/)
    assert.match(out, /const \$t0 = template\(`/)
    assert.match(out, /return \$el0 \}/)
    assert.doesNotMatch(out, /\bjsx\(/)
  })

  it("compiles mount component root with jsxDEV", () => {
    const out = transformDom(`
"use dom";
import { jsxDEV } from "kiru/jsx-dev-runtime";
import { mount } from "kiru/dom";

function App() {
  return () => jsxDEV("div", { children: "x" }, void 0, false, {}, void 0);
}

export function mountApp(container) {
  return mount(() => jsxDEV(App, {}, void 0, false, {}, void 0), container);
}
`)
    assert.match(out, /createComponent\(App/)
    assert.doesNotMatch(out, /\bjsxDEV\(/)
  })
})
