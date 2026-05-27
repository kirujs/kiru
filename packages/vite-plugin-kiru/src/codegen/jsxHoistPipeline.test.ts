import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString, TransformCTX } from "./shared.js"
import {
  applyJsxHoistAndTemplates,
  jsxTransformChanged,
} from "./jsxHoistPipeline.js"
import {
  ANOTHER_COUNTER_SETUP_RETURN,
  APP_SETUP_RETURN,
  COUNTER_DIRECT_RETURN,
  COUNTER_SETUP_RETURN_MODULE_COUNT,
  COUNTER_SETUP_RETURN_SETUP_COUNT,
  VITE_RESOLVED_JSX_RUNTIME_IMPORT,
} from "./testFixtures/counterProd.js"

const HOISTED_BADGE_SOURCE = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const initialCount = signal(0)

const StaticBadge = () =>
  jsxDEV("span", { className: "badge", children: "OK" }, void 0, false, void 0, this)
`

const HOISTED_COMMA_SOURCE = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const initialCount = signal(0)

const $k0 = jsxDEV("input", { "bind:value": initialCount, type: "number" }, void 0, false, void 0, this),
  $k1 = jsxDEV("span", { className: "badge", children: "OK" }, void 0, false, void 0, this)
$k0.meta={ flags: ($k0.meta?.flags??0)|32 }
$k1.meta={ flags: ($k1.meta?.flags??0)|32 }

const StaticBadge = () => $k1
`

const VITE_RESOLVED_JSX_IMPORT =
  'import { jsxDEV } from "/@fs/C:/repos/kiru/kiru/packages/lib/dist/jsx.js"'

function runPipeline(
  source: string,
  filePath = "/project/src/app.tsx"
): { ctx: TransformCTX; initialCode: MagicString } {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const initialCode = new MagicString(source)
  const ctx: TransformCTX = {
    code: initialCode,
    ast,
    isBuild: false,
    fileLinkFormatter: (id: string) => id,
    filePath,
    log: () => {},
  }
  applyJsxHoistAndTemplates(ctx)
  assert.strictEqual(
    ctx.code,
    initialCode,
    "pipeline must mutate the same MagicString instance"
  )
  return { ctx, initialCode }
}

/** Same return path as \`vite-plugin-kiru:jsx-hoist\` in src/index.ts */
function transformLikeJsxHoistPlugin(source: string): string | null {
  const { ctx } = runPipeline(source)
  if (!jsxTransformChanged(ctx)) return null
  return ctx.code.toString()
}

describe("jsx-hoist plugin pipeline", () => {
  it("returns templated output via ctx.code (inline static badge)", () => {
    const out = transformLikeJsxHoistPlugin(HOISTED_BADGE_SOURCE)
    assert.ok(out)
    assert.match(
      out,
      /import \{[^}]*_template[^}]*createHoledTemplate[^}]*\} from "kiru\/template"/
    )
    assert.match(out, /\$t\d+ = _template\(/)
    assert.doesNotMatch(out, /jsxDEV\("span", \{ className: "badge"/)
  })

  it("returns templated output for hoisted $k1 in a comma declarator list", () => {
    const out = transformLikeJsxHoistPlugin(HOISTED_COMMA_SOURCE)
    assert.ok(out)
    assert.match(out, /\$t\d+ = _template\(/)
    assert.match(out, /StaticBadge = \(\) => \$t\d+/)
    assert.doesNotMatch(out, /\$k1 = jsxDEV\("span"/)
  })

  it("templates hoisted badge when jsxDEV is a Vite-resolved /@fs import", () => {
    const source = HOISTED_COMMA_SOURCE.replace(
      'import { jsxDEV } from "kiru/jsx-dev-runtime"',
      VITE_RESOLVED_JSX_IMPORT
    )
    const out = transformLikeJsxHoistPlugin(source)
    assert.ok(out)
    assert.match(out, /\$t\d+ = _template\(/)
    assert.doesNotMatch(out, /\$k1 = jsxDEV\("span"/)
  })

  it("Counter direct return: 2-hole shell, folded Badge, hoisted button hole payload", () => {
    const source = `
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
`
    const out = transformLikeJsxHoistPlugin(source)
    assert.ok(out)
    assert.match(
      out,
      /\$t0 = _template\([^)]*<span class=\\"badge\\">OK<\/span>/
    )
    assert.match(out, /\$t1 = _template\(`[^`]*\$\{\$t0\.html\}[^`]*`, 2\)/)
    assert.doesNotMatch(
      out,
      /\$t1 = _template\([^)]*<span class=\\"badge\\">OK<\/span>/
    )
    assert.match(
      out,
      /const \$r0 = \/\* @__PURE__ \*\/ createHoledTemplate\(\$t\d+, \[\[[\s\S]*\], jsxDEV\("button"/
    )
    assert.match(out, /return \$r0/)
    assert.doesNotMatch(out, /^const \$k\d+ = jsxDEV\("button"/m)
    assert.doesNotMatch(out, /\{kind:"component"/)
  })

  it("setup-return Counter matches direct-return template lowering (module count)", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const count = signal(0)
export const Counter = () => {
  return () => (
    jsxDEV("div", { children: [
      jsxDEV("h1", { children: ["Count: ", count] }, void 0, true, void 0, this),
      jsxDEV("button", { onclick: () => count.set((c) => c + 1), children: "Increment" }, void 0, false, void 0, this),
      jsxDEV(Badge, {}, void 0, false, void 0, this),
      jsxDEV("div", { children: 123 }, void 0, true, void 0, this),
    ] }, void 0, true, void 0, this)
  )
}
const Badge = () => jsxDEV("span", { className: "badge", children: "OK" }, void 0, false, void 0, this)
`
    const out = transformLikeJsxHoistPlugin(source)
    assert.ok(out)
    assert.match(
      out,
      /\$t0 = _template\([^)]*<span class=\\"badge\\">OK<\/span>/
    )
    assert.match(out, /\$t1 = _template\(`[^`]*\$\{\$t0\.html\}[^`]*`, 2\)/)
    assert.match(out, /const \$r0 = \/\* @__PURE__ \*\/ createHoledTemplate\(\$t1/)
    assert.match(out, /return \(\) =>[\s\S]*\$r0/)
  })

  it("AnotherCounter setup-return: folds Badge via template ref, not jsxDEV(Badge)", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const Badge = () => jsxDEV("span", { className: "badge", children: "OK" }, void 0, false, void 0, this)

export const AnotherCounter = () => {
  const count = signal(0)
  return () => (
    jsxDEV("div", { children: [
      jsxDEV("h1", { children: ["Count: ", count] }, void 0, true, void 0, this),
      jsxDEV("button", { onclick: () => count.set((c) => c + 1), children: "Increment" }, void 0, false, void 0, this),
      jsxDEV(Badge, {}, void 0, false, void 0, this),
    ] }, void 0, true, void 0, this)
  )
}
`
    const out = transformLikeJsxHoistPlugin(source)
    assert.ok(out)
    assert.match(
      out,
      /\$t0 = _template\([^)]*<span class=\\"badge\\">OK<\/span>/
    )
    assert.match(out, /\$t1 = _template\(`[^`]*\$\{\$t0\.html\}/)
    assert.doesNotMatch(out, /jsxDEV\(Badge/)
    assert.match(out, /createHoledTemplate\(\$t1/)
  })

  it("setup-hoists holed template payloads for setup Counter shape", () => {
    const source = `
import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const Badge = () => jsxDEV("span", { className: "badge", children: "OK" }, void 0, false, void 0, this)

export const Counter = () => {
  const count = signal(0)
  return () => (
    jsxDEV("div", { children: [
      jsxDEV("h1", { children: ["Count: ", count] }, void 0, true, void 0, this),
      jsxDEV("button", { onclick: () => count.set((c) => c + 1), children: "Increment" }, void 0, false, void 0, this),
      jsxDEV(Badge, {}, void 0, false, void 0, this),
      jsxDEV("div", { children: 123 }, void 0, true, void 0, this),
    ] }, void 0, true, void 0, this)
  )
}
`
    const out = transformLikeJsxHoistPlugin(source)
    assert.ok(out)
    assert.match(out, /_template\([^)]*, 2\)/)
    assert.match(out, /const count = signal\(0\)/)
    assert.match(
      out,
      /const \$r0 = \/\* @__PURE__ \*\/ createHoledTemplate\(\$t\d+,[\s\S]*jsxDEV\("h1"/
    )
    assert.match(out, /return \(\) => \$r0/)
    assert.doesNotMatch(out, /const \$k\d+ = jsxDEV\("button"/)
  })

  it("regression: returning the initial MagicString ref drops template lowering", () => {
    const { ctx, initialCode } = runPipeline(HOISTED_COMMA_SOURCE)
    const fromCtx = ctx.code.toString()

    assert.strictEqual(ctx.code, initialCode)
    assert.match(fromCtx, /\$t\d+ = _template\(/)
    assert.doesNotMatch(HOISTED_COMMA_SOURCE, /\$t\d+ = _template\(/)
    assert.notEqual(fromCtx, HOISTED_COMMA_SOURCE)
  })
})

describe("jsx-hoist plugin pipeline (production jsx/jsxs)", () => {
  it("Counter direct return: composed badge, 2-hole shell, hoisted button", () => {
    const out = transformLikeJsxHoistPlugin(COUNTER_DIRECT_RETURN)
    assert.ok(out)
    assert.match(
      out,
      /\$t0 = _template\([^)]*<span class=\\"badge\\">OK<\/span>/
    )
    assert.match(out, /\$t1 = _template\(`[^`]*\$\{\$t0\.html\}[^`]*`, 2\)/)
    assert.doesNotMatch(
      out,
      /\$t1 = _template\([^)]*<span class=\\"badge\\">OK<\/span>/
    )
    assert.match(
      out,
      /const \$r0 = \/\* @__PURE__ \*\/ createHoledTemplate\(\$t\d+, \[\[[\s\S]*\], jsx\("button"/
    )
    assert.match(out, /return \$r0/)
    assert.doesNotMatch(out, /^const \$k\d+ = jsx\("button"/m)
    assert.doesNotMatch(out, /\{kind:"component"/)
    assert.doesNotMatch(out, /jsxDEV\(/)
  })

  it("setup-return Counter matches direct-return template lowering (module count)", () => {
    const out = transformLikeJsxHoistPlugin(COUNTER_SETUP_RETURN_MODULE_COUNT)
    assert.ok(out)
    assert.match(
      out,
      /\$t0 = _template\([^)]*<span class=\\"badge\\">OK<\/span>/
    )
    assert.match(out, /\$t1 = _template\(`[^`]*\$\{\$t0\.html\}[^`]*`, 2\)/)
    assert.match(out, /const \$r0 = \/\* @__PURE__ \*\/ createHoledTemplate\(\$t1/)
    assert.match(out, /return \(\) => \$r0/)
  })

  it("AnotherCounter setup-return: folds Badge via template ref, not jsx(Badge)", () => {
    const out = transformLikeJsxHoistPlugin(ANOTHER_COUNTER_SETUP_RETURN)
    assert.ok(out)
    assert.match(
      out,
      /\$t0 = _template\([^)]*<span class=\\"badge\\">OK<\/span>/
    )
    assert.match(out, /\$t1 = _template\(`[^`]*\$\{\$t0\.html\}/)
    assert.doesNotMatch(out, /jsx\(Badge/)
    assert.match(out, /createHoledTemplate\(\$t1/)
  })

  it("setup-hoists holed template payloads for setup Counter shape", () => {
    const out = transformLikeJsxHoistPlugin(COUNTER_SETUP_RETURN_SETUP_COUNT)
    assert.ok(out)
    assert.match(out, /_template\([^)]*, 2\)/)
    assert.match(out, /const count = signal\(0\)/)
    assert.match(
      out,
      /const \$r0 = \/\* @__PURE__ \*\/ createHoledTemplate\(\$t\d+,[\s\S]*jsxs\("h1"/
    )
    assert.match(out, /return \(\) => \$r0/)
  })

  it("App setup-return: holed shell with conditional and component regions", () => {
    const out = transformLikeJsxHoistPlugin(APP_SETUP_RETURN)
    assert.ok(out)
    assert.match(
      out,
      /const \$r0 = \/\* @__PURE__ \*\/ createHoledTemplate\(\$t\d+,[\s\S]*jsx\("button"/
    )
    assert.match(out, /\(\) => \(toggled\(\) &&/)
    assert.match(out, /\{kind:"conditional"/)
    assert.match(out, /\{kind:"component"/)
    assert.match(out, /\$k\d+ = jsx\(AnotherCounter/)
    assert.match(out, /return \(\) => \$r0/)
    assert.doesNotMatch(out, /const \$k\d+ = jsx\("button"/)
    assert.doesNotMatch(out, /const \$k\d+ = \(\) =>/)
    assert.doesNotMatch(out, /createHoledTemplate\([\s\S]*jsx\(AnotherCounter/)
  })

  it("templates counter when jsx/jsxs use Vite-resolved /@fs import", () => {
    const source = COUNTER_DIRECT_RETURN.replace(
      'import { jsx, jsxs } from "kiru/jsx-runtime"',
      VITE_RESOLVED_JSX_RUNTIME_IMPORT
    )
    const out = transformLikeJsxHoistPlugin(source)
    assert.ok(out)
    assert.match(out, /\$t1 = _template\(`[^`]*\$\{\$t0\.html\}/)
    assert.match(out, /createHoledTemplate\(\$t\d+/)
  })
})
