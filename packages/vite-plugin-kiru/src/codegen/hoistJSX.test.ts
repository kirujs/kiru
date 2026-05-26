import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "./shared.js"
import { prepareJSXHoisting } from "./hoistJSX.js"

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
    assert.ok(signalIdx < hoistIdx, "module signal must be declared before hoisted JSX")
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
    assert.match(out, /\$k0\.meta=\{ flags: \(\$k0\.meta\?\.flags\?\?0\)\|32/)
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
    assert.match(out, /const \$k\d+ = jsxs\(/)
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
    assert.match(out, /const \$k\d+ = jsxDEV\(/)
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
    assert.match(out, /const \$k\d+ = jsxDEV\(/)
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
    assert.match(out, /\$k\d+\.meta=\{ flags: \(\$k\d+\.meta\?\.flags\?\?0\)\|32/)
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
    assert.doesNotMatch(out, /\$k\d+\.meta=\{ flags: \(\$k\d+\.meta\?\.flags\?\?0\)\|32/)
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
    assert.match(out, /regions:\s*\[\{kind:"insert",slot:1\}\]/)
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
    assert.doesNotMatch(out, /\$k\d+\.meta=\{ flags: \(\$k\d+\.meta\?\.flags\?\?0\)\|32/)
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
    assert.doesNotMatch(out, /\$k\d+\.meta=\{ flags: \(\$k\d+\.meta\?\.flags\?\?0\)\|32/)
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
    assert.match(out, /\$k\d+\.meta=\{ flags: \(\$k\d+\.meta\?\.flags\?\?0\)\|32/)
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
    assert.match(out, /regions:\s*\[\{kind:"insert",slot:1\}\]/)
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

  it("does not hoist render JSX that closes over setup-scoped signals", () => {
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
    assert.doesNotMatch(out, /const \$k\d+ = jsxs\(/)
    assert.match(out, /return \(\) =>/)
    assert.match(out, /jsxs\("div"/)
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

  it("assigns compile regions via Object.assign inside render arrow", () => {
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
    assert.match(out, /Object\.assign\([\s\S]*meta:\{regions:\[[^\]]+\]\}/)
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
    assert.match(out, /const \$k\d+ = jsxDEV\(/)
  })

  it("hoists static jsx from a direct-return component", () => {
    const out = transformHoist(`
import { jsxs } from "kiru/jsx-runtime"

export function Page() {
  return jsxs("div", { class: "hero", children: [] })
}
`)
    assert.match(out, /const \$k\d+ = jsxs\(/)
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
    assert.match(out, /const \$k\d+ = jsxDEV\(/)
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
    assert.match(out, /const \$k\d+ = jsxDEV\([\s\S]*"input"/)
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
    assert.match(out, /const \$k\d+ = jsxDEV\([\s\S]*"input"/)
    assert.match(out, /\$k\d+\.meta=\{ flags: \(\$k\d+\.meta\?\.flags\?\?0\)\|32/)
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
    assert.match(out, /createHoledTemplate\(\$t0,\s*\[\s*\$k0,\s*children\s*,?\s*\]/)
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
    assert.match(out, /regions:\[\{kind:"insert",slot:1\}\]/)
    assert.match(out, /children: \[\s*\$k0,/)
    assert.doesNotMatch(
      out,
      /return[\s\S]*jsxDEV\("h1", \{ children: "Title" \}/
    )
  })
})
