import { describe, it } from "node:test"
import assert from "node:assert"
import * as esbuild from "esbuild"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { readFileSync } from "node:fs"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "./shared.js"
import {
  applyJsxHoistAndTemplates,
  jsxTransformChanged,
} from "./jsxHoistPipeline.js"

const repoRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../.."
)
const counterTsx = path.join(repoRoot, "sandbox/primitive/src/counter.tsx")

async function esbuildCounterToJs(): Promise<string> {
  const source = readFileSync(counterTsx, "utf8")
  const result = await esbuild.transform(source, {
    loader: "tsx",
    jsx: "automatic",
    jsxImportSource: "kiru",
    jsxDev: false,
    format: "esm",
    target: "es2022",
  })
  return result.code
}

function transformPipeline(source: string): string | null {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const ctx = {
    code: new MagicString(source),
    ast,
    isBuild: true,
    fileLinkFormatter: (id: string) => id,
    filePath: counterTsx,
    log: () => {},
  }
  applyJsxHoistAndTemplates(ctx)
  if (!jsxTransformChanged(ctx)) return null
  return ctx.code.toString()
}

describe("jsx-hoist pipeline on esbuild production output", () => {
  it("lowers sandbox counter.tsx with composed badge templates", async () => {
    const compiled = await esbuildCounterToJs()
    assert.match(compiled, /jsx|jsxs/)
    assert.doesNotMatch(compiled, /jsxDEV/)

    const out = transformPipeline(compiled)
    assert.ok(out, "pipeline should transform esbuild output")
    assert.match(out, /\$t0 = _template\([^)]*badge/)
    assert.match(out, /\$t1 = _template\(`[^`]*\$\{\$t0\.html\}/)
    assert.match(out, /<div>123 asdasd<p>Hello world<\/p>/)
    assert.match(out, /\$k\d+ = jsx\(Toggler/)
    assert.match(
      out,
      /const \$r0 = createHoledTemplate\(\$t1,[\s\S]*\$k\d+[\s\S]*kind:"component",anchor:1/
    )
    assert.match(out, /return \$r0/)
    assert.match(out, /\$t3 = _template\("<div><button>Toggle<\/button><!--#--><\/div>", 1, 1, \[[\d,]+\]\)/)
    assert.match(
      out,
      /const \$r\d+ = createHoledTemplate\(\$t3,[\s\S]*\(\) => \(\s*toggled\(\) &&[\s\S]*kind:"conditional",anchor:0/
    )
    assert.doesNotMatch(out, /jsx\(Badge/)
    assert.doesNotMatch(out, /jsxDEV\(/)
  })
})
