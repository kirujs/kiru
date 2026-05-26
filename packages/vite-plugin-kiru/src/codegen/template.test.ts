import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "./shared.js"
import { applyJsxHoistAndTemplates } from "./jsxHoistPipeline.js"

function transform(source: string): string {
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
  applyJsxHoistAndTemplates(ctx)
  return ctx.code.toString()
}

describe("prepareJSXTemplates", () => {
  it("lowers static badge to _template", () => {
    const out = transform(`
import { jsxDEV } from "kiru/jsx-dev-runtime"

const StaticBadge = () =>
  jsxDEV("span", { className: "badge", children: "OK" }, void 0, false, void 0, this)
`)
    assert.match(out, /import \{ _template, createHoledTemplate \} from "kiru\/template"/)
    assert.match(out, /const \$t\d+ = _template\(/)
    assert.match(out, /\$t\d+\(\)|createHoledTemplate\(\$t\d+,/)
    assert.doesNotMatch(out, /jsxDEV\("span", \{ className: "badge"/)
  })

  it("templates mixed jsxs as one holed shell", () => {
    const out = transform(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const n = signal(0)

const Mixed = () =>
  Object.assign(
    jsxDEV(
      "div",
      {
        children: [
          jsxDEV("span", { children: "A" }, void 0, false, void 0, this),
          jsxDEV("span", { children: n }, void 0, true, void 0, this),
        ],
      },
      void 0,
      true,
      void 0,
      this
    ),
    { meta: { dynamicIndices: [1] } }
  )
`)
    assert.match(out, /import \{ _template, createHoledTemplate \} from "kiru\/template"/)
    assert.match(out, /_template\([^)]*<!--#-->/)
    assert.match(out, /createHoledTemplate\(\$t\d+,/)
    assert.doesNotMatch(out, /jsxDEV\("span", \{ children: "A" \}/)
  })

  it("templates one hoisted declarator in a comma-separated const $k0, $k1 list", () => {
    const out = transform(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const initialCount = signal(0)

const $k0 = jsxDEV("input", { "bind:value": initialCount, type: "number" }, void 0, false, void 0, this),
  $k1 = jsxDEV("span", { className: "badge", children: "OK" }, void 0, false, void 0, this)
$k0.meta={ flags: ($k0.meta?.flags??0)|32 }
$k1.meta={ flags: ($k1.meta?.flags??0)|32 }

const StaticBadge = () => $k1
`)
    assert.match(out, /\$t\d+ = _template\(/)
    assert.match(out, /const \$k0 = jsxDEV\("input"/)
    assert.match(out, /StaticBadge = \(\) => \$t\d+\(\)/)
    assert.doesNotMatch(out, /\$k1\.meta=/)
    assert.doesNotMatch(out, /,\s*\n\s*\$k1 = jsxDEV\("span"/)
  })

  it("templates primitive App shell with bind input and component holes", () => {
    const out = transform(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal, setup } from "kiru"

const initialCount = signal(0)

const Counter = () => {
  const { derive } = setup()
  const count = derive((props) => props.foo.initialCount)
  return (props) =>
    jsxDEV("div", { children: [
      jsxDEV("p", { children: ["Items: ", props.items] }, void 0, true, void 0, this),
      jsxDEV("h1", { children: ["Count: ", count] }, void 0, true, void 0, this),
    ] }, void 0, true, void 0, this)
}

export function App() {
  return jsxDEV(
    "div",
    {
      children: [
        jsxDEV("input", { "bind:value": initialCount, type: "number" }, void 0, false, void 0, this),
        jsxDEV(Counter, { foo: { initialCount: initialCount() }, items: [initialCount(), 2, 3] }, void 0, false, void 0, this),
      ],
    },
    void 0,
    true,
    void 0,
    this
  )
}
`)
    assert.match(out, /import \{ _template, createHoledTemplate \} from "kiru\/template"/)
    assert.match(out, /_template\([^)]*<!--#-->/)
    assert.match(out, /createHoledTemplate\(\$t\d+,/)
    assert.match(out, /const \$k\d+ = jsxDEV\("input"/)
    assert.match(out, /jsxDEV\(\s*Counter/)
  })

  it("templates layout shell with region nav, outlet, and module-hoisted link list", () => {
    const out = transform(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { Link } from "kiru/router"

export default function Layout({ children }) {
  return jsxDEV("div", {
    className: "shell",
    children: [
      jsxDEV("h1", { children: "Title" }, void 0, false, void 0, this),
      jsxDEV("nav", { children: [
        jsxDEV(Link, { to: "/", children: "Home" }, void 0, false, void 0, this),
        jsxDEV(Link, { to: "/about", children: "About" }, void 0, false, void 0, this),
      ] }, void 0, true, void 0, this),
      jsxDEV("div", { className: "outlet", children }, void 0, false, void 0, this),
    ],
  }, void 0, true, void 0, this)
}
`)
    assert.match(out, /import \{[^}]*createHoledTemplate[^}]*\} from "kiru\/template"/)
    assert.match(out, /tagStaticChildrenList/)
    assert.match(out, /\$t\d+ = _template\([^)]*<h1>Title<\/h1>/)
    assert.match(out, /_template\([^)]*, 2\)/)
    assert.match(out, /_template\([^)]*class=\\"outlet\\"/)
    const navMarkers = out.match(
      /<nav[^>]*>([\s\S]*?)<\/nav>/
    )?.[1]
    assert.ok(navMarkers)
    assert.strictEqual((navMarkers.match(/<!--#-->/g) ?? []).length, 1)
    assert.match(out, /const \$k\d+ = tagStaticChildrenList\(\[/)
    assert.match(out, /createHoledTemplate\(\$t\d+, \[\$k\d+, children\]\)/)
    assert.doesNotMatch(
      out,
      /return[\s\S]*jsxDEV\(Link/
    )
    assert.doesNotMatch(
      out,
      /const \$k1 = jsxDEV\(Link/
    )
    assert.doesNotMatch(
      out,
      /createHoledTemplate\(\$t\d+,[\s\S]*jsxDEV\("div", \{ className: "outlet"/
    )
    assert.doesNotMatch(
      out,
      /return[\s\S]*jsxDEV\("h1", \{ children: "Title" \}/
    )
  })

  it("does not template Counter render tree with signals", () => {
    const out = transform(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { setup, signal } from "kiru"

const Counter = () => {
  const { derive } = setup()
  const count = derive((props) => props.foo.initialCount)
  return (props) =>
    jsxDEV("div", {
      children: [
        jsxDEV("p", { children: ["Items: ", props.items] }, void 0, true, void 0, this),
        jsxDEV("h1", { children: ["Count: ", count] }, void 0, true, void 0, this),
      ],
    }, void 0, true, void 0, this)
}
`)
    assert.doesNotMatch(out, /_template\([\s\S]*Items:/)
  })
})
