import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "./shared.js"
import {
  applyJsxHoistAndTemplates,
  jsxTransformChanged,
} from "./jsxHoistPipeline.js"

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
): { ctx: { code: MagicString }; initialCode: MagicString } {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const initialCode = new MagicString(source)
  const ctx = {
    code: initialCode,
    ast,
    isBuild: false,
    fileLinkFormatter: (id: string) => id,
    filePath,
    log: () => {},
  }
  applyJsxHoistAndTemplates(ctx)
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
    assert.match(out, /StaticBadge = \(\) => \$t\d+\(\)/)
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

  it("regression: returning the initial MagicString ref drops template lowering", () => {
    const { ctx, initialCode } = runPipeline(HOISTED_COMMA_SOURCE)
    const fromCtx = ctx.code.toString()
    const stale = initialCode.toString()

    assert.match(fromCtx, /\$t\d+ = _template\(/)
    assert.doesNotMatch(stale, /\$t\d+ = _template\(/)
    assert.match(stale, /\$k1 = jsxDEV\("span"/)
    assert.notEqual(stale, fromCtx)
  })
})
