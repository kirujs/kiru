import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "./shared.js"
import { prepareJSXHoisting } from "./hoistJSX.js"
import { applyJsxHoistAndTemplates } from "./jsxHoistPipeline.js"

function transformHoist(source: string): string {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const code = new MagicString(source)
  prepareJSXHoisting({
    code,
    ast,
    isBuild: false,
    fileLinkFormatter: (id) => id,
    filePath: "/project/src/page.tsx",
    log: () => {},
  })
  return code.toString()
}

function transformPipeline(source: string): string {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const ctx = {
    code: new MagicString(source),
    ast,
    isBuild: false,
    fileLinkFormatter: (id: string) => id,
    filePath: "/project/src/counter.tsx",
    log: () => {},
  }
  applyJsxHoistAndTemplates(ctx)
  return ctx.code.toString()
}

describe("prepareJSXHoisting", () => {
  it("inserts hoisted declarations after module bindings they reference", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const initialCount = signal(0)

export function App() {
  return jsxDEV("input", { "bind:value": initialCount, type: "number" }, void 0, false, {
    fileName: "app.tsx",
    lineNumber: 8,
    columnNumber: 7,
  }, this)
}

const Badge = () =>
  jsxDEV("span", { className: "badge", children: "OK" }, void 0, false, {
    fileName: "app.tsx",
    lineNumber: 24,
    columnNumber: 27,
  }, this)
`)
    const signalIdx = out.indexOf("const initialCount = signal(0)")
    const hoistIdx = out.indexOf("const $k0")
    const appIdx = out.indexOf("export function App")
    assert.ok(signalIdx !== -1)
    assert.ok(hoistIdx !== -1)
    assert.ok(
      signalIdx < hoistIdx,
      "module signal must be declared before hoisted JSX"
    )
    assert.ok(hoistIdx < appIdx, "hoisted JSX must precede first use in App")
  })

  it("inserts hoisted declarations after imports before first use", () => {
    const out = transformHoist(`
import { mount } from "kiru"
import { jsxDEV } from "kiru/jsx-dev-runtime"

mount(
  jsxDEV("div", { id: "app", children: "loading" }, void 0, false, {
    fileName: "main.tsx",
    lineNumber: 5,
    columnNumber: 3,
  }, this),
  document.getElementById("app")
)
`)
    const declIdx = out.indexOf("const $k0")
    const mountIdx = out.indexOf("mount(")
    assert.ok(declIdx !== -1, "expected hoisted declaration")
    assert.ok(mountIdx !== -1, "expected mount call")
    assert.ok(declIdx < mountIdx, "hoisted const must be declared before use")
    assert.match(out, /const \$k0 = markHoisted\(jsxDEV/)
  })

  it("hoists static jsxs subtrees imported from kiru/jsx-runtime", () => {
    const out = transformHoist(`
import { jsx, jsxs } from "kiru/jsx-runtime"

export function Page() {
  return jsxs("div", {
    class: "hero",
    children: [
      jsx("span", { children: "Hello" }),
      jsx("span", { children: "World" }),
    ],
  })
}
`)
    assert.match(out, /const \$k\d+ = markHoisted\(jsxs\(/)
    assert.match(out, /return \$k\d+/)
    assert.doesNotMatch(out, /return jsxs\("div"/)
  })

  it("does not hoist jsxs when props reference a variable", () => {
    const out = transformHoist(`
import { jsxs } from "kiru/jsx-runtime"

export function Page({ title }) {
  return jsxs("div", { class: title, children: [] })
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = jsxs\(/)
    assert.match(out, /return jsxs\("div"/)
  })

  it("hoists static jsxDEV subtrees imported from kiru/jsx-dev-runtime", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"

export function Page() {
  return jsxDEV(
    "div",
    {
      class: "hero",
      children: [
        jsxDEV(
          "span",
          { children: "a" },
          undefined,
          true,
          { fileName: "page.tsx", lineNumber: 10, columnNumber: 1 },
          void 0
        ),
        jsxDEV(
          "span",
          { children: "b" },
          undefined,
          true,
          { fileName: "page.tsx", lineNumber: 11, columnNumber: 1 },
          void 0
        ),
      ],
    },
    undefined,
    true,
    { fileName: "page.tsx", lineNumber: 8, columnNumber: 1 },
    void 0
  )
}
`)
    assert.match(out, /const \$k\d+ = markHoisted\(jsxDEV\(/)
    assert.match(out, /return \$k\d+/)
    assert.doesNotMatch(out, /return jsxDEV\(\s*"div"/)
  })

  it("does not hoist jsxDEV when props reference a variable", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"

export function Page({ title }) {
  return jsxDEV(
    "div",
    { class: title },
    undefined,
    false,
    { fileName: "page.tsx", lineNumber: 1, columnNumber: 1 },
    void 0
  )
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = jsxDEV\(/)
    assert.match(out, /return jsxDEV\(/)
  })

  it("does not hoist jsxDEV when source metadata is dynamic", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"

export function Page() {
  return jsxDEV(
    "div",
    { class: "hero" },
    undefined,
    false,
    { fileName: import.meta.url, lineNumber: 1, columnNumber: 1 },
    void 0
  )
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = jsxDEV\(/)
    assert.match(out, /return jsxDEV\(/)
  })

  it("hoists jsxDEV with isStaticChildren false when otherwise static", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"

export function Page() {
  return jsxDEV(
    "div",
    { children: "only" },
    undefined,
    false,
    { fileName: "page.tsx", lineNumber: 1, columnNumber: 1 },
    void 0
  )
}
`)
    assert.match(out, /const \$k\d+ = markHoisted\(jsxDEV\(/)
    assert.match(out, /return \$k\d+/)
  })

  it("marks fully static hoisted jsxs roots with FLAG_HOISTED", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"

export function Page() {
  return jsxs("div", {
    class: "hero",
    children: [jsx("span", { children: "a" })],
  })
}
`)
    assert.match(out, /const \$k\d+ = markHoisted\(jsx/)
  })

  it("does not mark hoisted jsxs when a child slot is dynamic", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"

export function Page({ label }) {
  return jsxs("div", {
    children: [jsx("span", { children: label })],
  })
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = regionElement\(jsx/)
  })

  it("emits compile regions for mixed static hoisted jsxs children", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

const count = signal(0)

export function Page() {
  return jsxs("div", {
    children: [
      jsx("span", { children: "static" }),
      jsx("span", { children: count }),
    ],
  })
}
`)
    assert.match(out, /regionElement\([\s\S]*\{kind:"node",slot:1\}/)
  })

  it("does not mark FLAG_HOISTED when a child uses count()", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

const count = signal(0)

export function Page() {
  return jsxs("div", {
    children: [jsx("span", { children: count() })],
  })
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = regionElement\(jsx/)
  })

  it("does not mark FLAG_HOISTED for arbitrary impure calls like formatTitle()", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"

function formatTitle() {
  return "x"
}

export function Page() {
  return jsxs("div", {
    children: [jsx("span", { children: formatTitle() })],
  })
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = regionElement\(jsx/)
  })

  it("allows count.peek() inside an otherwise static hoisted child", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

const count = signal(0)

export function Page() {
  return jsxs("div", {
    children: [jsx("span", { children: count.peek() })],
  })
}
`)
    assert.match(out, /const \$k\d+ = markHoisted\(jsx/)
  })

  it("marks compile regions for count() in a mixed jsxs children array", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

const count = signal(0)

export function Page() {
  return jsxs("div", {
    children: [
      jsx("span", { children: "static" }),
      jsx("span", { children: count() }),
    ],
  })
}
`)
    assert.match(out, /regionElement\([\s\S]*\{kind:"node",slot:1\}/)
  })

  it("does not treat shadowed signal import as a signal factory", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

export function Page() {
  const _signal = signal
  const count = _signal(0)
  return () =>
    jsxs("div", {
      children: [jsx("span", { children: count() })],
    })
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = jsxs\(/)
    assert.match(out, /return \(\) =>[\s\S]*jsxs\("div"/)
  })

  it("auto-wraps signal-reading jsxs slot in render fn", () => {
    const out = transformPipeline(`
import { jsx, jsxs } from "kiru/jsx-runtime"
import { signal } from "kiru"

const Toggler = () => {
  const toggled = signal(false)
  return () => jsxs("div", { children: [
    jsx("button", { onclick: () => toggled.set((t) => !t), children: "Toggle" }),
    toggled() && jsx("p", { children: "Toggled" }),
  ] })
}
`)
    assert.match(out, /\(\) => \(toggled\(\) &&/)
    assert.match(
      out,
      /createHoledTemplate\(\$t\d+,[\s\S]*kind:"conditional",anchor:0/
    )
    assert.match(out, /kind:"event",prop:"onclick",nodeIndex:0/)
  })

  it("does not hoist jsx with inline fn children that close over render locals", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { useRouter } from "kiru/router"

export default function Page() {
  const router = useRouter()
  return () => {
    const nav = router.currentNavigation()
    return jsxDEV("div", { children: [
      jsxDEV("p", { children: [
        "Navigating: ",
        jsxDEV("strong", { children: () => (router.isNavigating() ? "yes" : "no") }, void 0, false, void 0, this),
      ] }, void 0, true, void 0, this),
      jsxDEV("p", { children: [
        "From: ",
        jsxDEV("strong", { children: () => (nav?.from ? nav.from.pathname : "—") }, void 0, false, void 0, this),
      ] }, void 0, true, void 0, this),
    ] }, void 0, true, void 0, this)
  }
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = jsxDEV\("p"/)
    assert.match(out, /router\.isNavigating/)
    assert.match(out, /nav\?\.from/)
  })

  it("setup-hoists render JSX that closes over setup-scoped signal identifier", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

export function Page() {
  const count = signal(0)
  return () =>
    jsxs("div", {
      children: [
        jsx("span", { children: "static" }),
        jsx("span", { children: count }),
      ],
    })
}
`)
    assert.doesNotMatch(out, /^const \$k\d+ = jsxs\(/m)
    assert.match(out, /const count = signal\(0\)/)
    assert.match(
      out,
      /const count = signal\(0\)[\s\S]*const \$k\d+ = regionElement\(jsxs/
    )
    assert.match(out, /return \(\) =>\s*\n?\s*\$k\d+/)
  })

  it("does not setup-hoist render root when a slot uses count()", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

export function Page() {
  const count = signal(0)
  return () =>
    jsxs("div", {
      children: [
        jsx("span", { children: "static" }),
        jsx("span", { children: count() }),
      ],
    })
}
`)
    assert.doesNotMatch(
      out,
      /const count = signal\(0\)[\s\S]*const \$k\d+ = regionElement\(jsxs/
    )
    assert.match(out, /return \(\) =>/)
  })

  it("does not hoist when setup().derive feeds render JSX", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"
import { setup } from "kiru"

const Counter = () => {
  const { derive } = setup()
  const count = derive((props) => props.value)
  return (props) =>
    jsxs("div", { children: [jsx("span", { children: count })] })
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = jsxs\(/)
  })

  it("transforms sandbox Counter shape (direct return) with 2-hole shell and hoisted button", () => {
    const out = transformPipeline(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const count = signal(0)
export const Counter = () => {
  return jsxDEV("div", { children: [
    jsxDEV("h1", { children: ["Count: ", count] }, void 0, true, void 0, this),
    jsxDEV("button", { onclick: () => count.set((c) => c + 1), children: "Increment" }, void 0, false, void 0, this),
    jsxDEV(Badge, {}, void 0, false, void 0, this),
    jsxDEV("div", { children: 123 }, void 0, true, void 0, this),
  ] }, void 0, true, void 0, this)
}
const Badge = () => jsxDEV("span", { className: "badge", children: "OK" }, void 0, false, void 0, this)
`)
    assert.match(out, /const count = signal\(0\)/)
    assert.match(
      out,
      /\$t\d+ = _template\([^)]*<span class=\\"badge\\">OK<\/span>/
    )
    assert.match(out, /_template\([^)]+, 1(?:, \d+)?\)/)
    assert.match(out, /<button>Increment<\/button>/)
    assert.match(
      out,
      /const \$r0 = \/\* @__PURE__ \*\/ createHoledTemplate\(\$t\d+, \[\[[\s\S]*\]\]/
    )
    assert.doesNotMatch(
      out,
      /createHoledTemplate\([\s\S]*jsxDEV\("button"/
    )
    assert.match(out, /return \$r0/)
    assert.doesNotMatch(out, /^const \$k\d+ = jsxDEV\("button"/m)
    assert.doesNotMatch(out, /\{kind:"component"/)
    assert.match(out, /Badge = \(\) => \$t\d+/)
  })

  it("allows onclick handler closing over module signal on hoisted jsxs", () => {
    const out = transformHoist(`
import { jsxs, jsx } from "kiru/jsx-runtime"
import { signal } from "kiru"

const count = signal(0)

export function Page() {
  return () =>
    jsxs("div", {
      children: [
        jsx("span", { children: count }),
        jsx("button", { onclick: () => count.set((c) => c + 1), children: "+" }),
      ],
    })
}
`)
    assert.match(out, /const \$k\d+ = regionElement\(jsxs/)
    assert.match(out, /return \(\) =>\s*\n?\s*\$k\d+/)
  })

  it("assigns compile regions via regionElement inside render arrow", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { setup } from "kiru"

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
    assert.doesNotMatch(out, /const \$__jsx\d+ = jsxDEV/)
    assert.match(out, /return \(props\) =>/)
    assert.match(out, /regionElement\([\s\S]*\[\{kind:/)
  })

  it("hoists when jsxDEV is imported from a Vite-resolved kiru jsx module", () => {
    const out = transformHoist(`
import { jsxDEV } from "/@fs/C:/repos/kiru/kiru/packages/lib/dist/jsx.js"

export function Page() {
  return jsxDEV("div", { class: "hero" }, void 0, false, {
    fileName: "page.tsx",
    lineNumber: 1,
    columnNumber: 1,
  }, void 0)
}
`)
    assert.match(out, /const \$k\d+ = markHoisted\(jsxDEV\(/)
  })

  it("hoists static jsx from a direct-return component", () => {
    const out = transformHoist(`
import { jsxs } from "kiru/jsx-runtime"

export function Page() {
  return jsxs("div", { class: "hero", children: [] })
}
`)
    assert.match(out, /const \$k\d+ = markHoisted\(jsxs\(/)
    assert.match(out, /return \$k\d+/)
  })

  it("hoists module-scope arrow component with jsxDEV this arg", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"

const Badge = () =>
  jsxDEV(
    "span",
    { className: "badge", children: "OK" },
    void 0,
    false,
    { fileName: "app.tsx", lineNumber: 24, columnNumber: 27 },
    this
  )
`)
    assert.match(out, /const \$k\d+ = markHoisted\(jsxDEV\(/)
    assert.match(out, /Badge = \(\) =>[\s\S]*\$k\d+/)
  })

  it("hoists input with bind:value module signal reference", () => {
    const out = transformHoist(`
import { jsxDEV, jsxs } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const count = signal(0)

export function App() {
  return jsxs("div", {
    children: [
      jsxDEV(
        "input",
        { "bind:value": count, type: "number" },
        void 0,
        false,
        { fileName: "app.tsx", lineNumber: 8, columnNumber: 7 },
        this
      ),
      jsxDEV(
        "span",
        { children: count() },
        void 0,
        false,
        { fileName: "app.tsx", lineNumber: 9, columnNumber: 7 },
        this
      ),
    ],
  }, void 0, true, {
    fileName: "app.tsx",
    lineNumber: 7,
    columnNumber: 5,
  }, this)
}
`)
    assert.match(out, /const \$k\d+ = markHoisted\(jsxDEV\([\s\S]*"input"/)
    assert.doesNotMatch(out, /const \$k\d+ = jsxs\("div"/)
    assert.match(out, /return jsxs\("div"/)
  })

  it("marks FLAG_HOISTED on hoisted input with module signal id only", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const count = signal(0)

export function App() {
  return jsxDEV(
    "input",
    { "bind:value": count, type: "number" },
    void 0,
    false,
    { fileName: "app.tsx", lineNumber: 1, columnNumber: 1 },
    this
  )
}
`)
    assert.match(out, /const \$k\d+ = markHoisted\(jsxDEV\([\s\S]*"input"/)
    assert.match(out, /const \$k\d+ = markHoisted\(jsx/)
  })

  it("does not hoist when subtree contains a signal read call", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const count = signal(0)

export function App() {
  return jsxDEV(
    "span",
    { children: count() },
    void 0,
    false,
    { fileName: "app.tsx", lineNumber: 1, columnNumber: 1 },
    this
  )
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = jsxDEV\(/)
    assert.match(out, /children: count\(\)/)
  })

  it("does not hoist template region arrays of component jsx", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { _template, createHoledTemplate } from "kiru/template"
import { Link } from "kiru/router"

const $t0 = _template("<nav><!--#--></nav>", 1)

export default function Layout({ children }) {
  return createHoledTemplate($t0, [
    [
      jsxDEV(Link, { to: "/", children: "Home" }, void 0, false, void 0, this),
      jsxDEV(Link, { to: "/about", children: "About" }, void 0, false, void 0, this),
    ],
    children,
  ])
}
`)
    assert.doesNotMatch(out, /tagStaticChildrenList/)
    assert.doesNotMatch(out, /const \$k\d+ = jsxDEV\(Link/)
    assert.match(out, /createHoledTemplate\(\$t0,\s*\[\s*\[/)
    assert.match(out, /return[\s\S]*jsxDEV\(Link/)
  })

  it("hoists template region arrays of intrinsic static jsx", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { _template, createHoledTemplate } from "kiru/template"

const $t0 = _template("<nav><!--#--></nav>", 1)

export default function Layout({ children }) {
  return createHoledTemplate($t0, [
    [
      jsxDEV("a", { href: "/", children: "Home" }, void 0, false, void 0, this),
      jsxDEV("a", { href: "/about", children: "About" }, void 0, false, void 0, this),
    ],
    children,
  ])
}
`)
    assert.match(out, /const \$k0 = tagStaticChildrenList\(\[/)
    assert.match(
      out,
      /createHoledTemplate\(\$t0,\s*\[\s*\$k0,\s*children\s*,?\s*\]/
    )
    assert.doesNotMatch(out, /return[\s\S]*jsxDEV\("a"/)
  })

  it("does not module-hoist component jsx calls", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { Link } from "kiru/router"

export function Nav() {
  return jsxDEV(Link, { to: "/", children: "Home" }, void 0, false, void 0, this)
}
`)
    assert.doesNotMatch(out, /const \$k\d+ = jsxDEV\(Link/)
    assert.match(out, /return jsxDEV\(Link/)
  })

  it("caches createHoledTemplate render root for setup-return Counter", () => {
    const out = transformPipeline(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const Badge = () => jsxDEV("span", { className: "badge", children: "OK" }, void 0, false, void 0, this)

export const Counter = () => {
  const count = signal(0)
  return () =>
    jsxDEV("div", { children: [
      jsxDEV("h1", { children: ["Count: ", count] }, void 0, true, void 0, this),
      jsxDEV("button", { onclick: () => count.set((c) => c + 1), children: "Increment" }, void 0, false, void 0, this),
      jsxDEV(Badge, {}, void 0, false, void 0, this),
      jsxDEV("div", { children: 123 }, void 0, true, void 0, this),
    ] }, void 0, true, void 0, this)
}
`)
    assert.match(
      out,
      /const \$r0 = \/\* @__PURE__ \*\/ createHoledTemplate\(\$t\d+,[\s\S]*\["Count: ", count\]/
    )
    assert.match(out, /\[\{kind:"text",anchor:0\}\]/)
    assert.match(out, /<button>Increment<\/button>/)
    assert.match(out, /kind:"event",prop:"onclick",nodeIndex:1/)
    assert.match(out, /return \(\) => \$r0/)
    assert.doesNotMatch(out, /const \$k\d+ = regionElement\(\s*jsxDEV\("h1"/)
    assert.doesNotMatch(out, /const \$k\d+ = jsxDEV\("button"/)
  })

  it("does not setup-hoist createHoledTemplate hole payload when payload uses count()", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"
import { _template, createHoledTemplate } from "kiru/template"

const $t0 = _template("<div><!--#--></div>", 1)

export const Counter = () => {
  const count = signal(0)
  return () =>
    createHoledTemplate($t0, [
      jsxDEV("h1", { children: ["Count: ", count()] }, void 0, true, void 0, this),
    ], [{kind:"node",anchor:0}])
}
`)
    assert.doesNotMatch(
      out,
      /const count = signal\(0\)[\s\S]*const \$k\d+ = jsxDEV\("h1"/
    )
    assert.match(out, /count\(\)/)
  })

  it("module-hoists conditional template hole when only module signals are referenced", () => {
    const out = transformPipeline(`
import { jsx, jsxs } from "kiru/jsx-runtime"
import { signal } from "kiru"

const count = signal(0)
export const App = () =>
  jsxs("div", { children: count() % 2 === 0 && jsx("p", { children: "even" }) })
`)
    assert.match(out, /\$k\d+ = \(\) => \(count\(\) % 2 === 0 &&/)
    assert.match(out, /createHoledTemplate\(\$t\d+,\s*\[\s*\$k\d+/)
    assert.doesNotMatch(out, /createHoledTemplate\([\s\S]*count\(\) % 2/)
  })

  it("caches conditional template hole inline in setup-return render root", () => {
    const out = transformPipeline(`
import { jsx, jsxs } from "kiru/jsx-runtime"
import { signal } from "kiru"

function Counter() {
  return jsx("span", { children: "c" })
}

export function App() {
  const toggled = signal(false)
  return () =>
    jsxs("div", { children: [
      jsx("span", { children: "label" }),
      toggled() && jsx(Counter, {}),
    ] })
}
`)
    assert.match(
      out,
      /const \$r0 = \/\* @__PURE__ \*\/ createHoledTemplate\(\$t1,[\s\S]*\(\) => \(toggled\(\) &&/
    )
    assert.match(out, /return \(\) => \$r0/)
    assert.doesNotMatch(out, /const \$k\d+ = \(\) =>/)
  })

  it("module-hoists static component jsx in a direct template hole", () => {
    const out = transformPipeline(`
import { jsx, jsxs } from "kiru/jsx-runtime"

function Toggler() {
  return jsx("button", { children: "t" })
}

export const Counter = () => jsxs("div", { children: [jsx(Toggler, {})] })
`)
    assert.match(out, /const \$k\d+ = jsx\(Toggler/)
    assert.match(
      out,
      /createHoledTemplate\(\$t\d+,[\s\S]*\$k\d+[\s\S]*kind:"component"/
    )
    assert.doesNotMatch(out, /children:\s*\[jsx\(Toggler/)
  })

  it("does not hoist conditional template hole that references renderLocal", () => {
    const out = transformPipeline(`
import { jsx, jsxs } from "kiru/jsx-runtime"
import { signal } from "kiru"

export function App() {
  return () => {
    const local = signal(false)
    return jsxs("div", { children: local() && jsx("p", { children: "x" }) })
  }
}
`)
    assert.match(out, /local\(\) &&\s*\$t0/)
    assert.doesNotMatch(out, /\$k\d+ = \(\) => \(local\(\) &&/)
  })

  it("does not hoist layout shell when children is a destructured param", () => {
    const out = transformHoist(`
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { Link } from "kiru/router"

export default function Layout({ children }) {
  return jsxDEV("div", {
    className: "shell",
    children: [
      jsxDEV("h1", { children: "Title" }, void 0, false, void 0, this),
      jsxDEV("div", { className: "outlet", children }, void 0, false, void 0, this),
    ],
  }, void 0, true, void 0, this)
}
`)
    const moduleScope = out.split(/export default/)[0]!
    assert.doesNotMatch(
      moduleScope,
      /const \$k\d+ = jsxDEV\("div", \{[\s\S]*\bchildren \}/
    )
    assert.match(out, /className: "outlet", children \}/)
    assert.match(out, /regionElement\([\s\S]*\{kind:"node",slot:1\}/)
    assert.match(out, /children: \[\s*\$k0,/)
    assert.doesNotMatch(
      out,
      /return[\s\S]*jsxDEV\("h1", \{ children: "Title" \}/
    )
  })
})
