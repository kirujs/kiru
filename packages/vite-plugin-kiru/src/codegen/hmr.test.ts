import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseAst } from "rollup/parseAst"
import type { AstNode } from "./ast.js"
import { MagicString } from "./shared.js"
import { findHotVars, prepareHMR } from "./hmr.js"

function hotList(source: string): HotVarEntry[] {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const code = new MagicString(source)
  const vars = findHotVars(code, ast.body as AstNode[], "/test/module.ts")
  return [...vars].sort(
    (a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type)
  )
}

type HotVarEntry = { type: string; name: string }

function transformHMR(source: string, filePath: string): string {
  writeFileSync(filePath, source, "utf-8")
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const code = new MagicString(source)
  prepareHMR({
    code,
    ast,
    isBuild: false,
    fileLinkFormatter: (_id, line) => `line:${line}`,
    filePath,
    log: () => {},
  })
  return code.toString()
}

const KIRU_IMPORT = `import { __API__ } from "kiru"\n`

function withApi(api: string, body: string): string {
  return KIRU_IMPORT.replace("__API__", api) + body
}

describe("findHotVars", () => {
  for (const api of [
    "signal",
    "resource",
    "computed",
    "effect",
    "createContext",
    "lazy",
  ] as const) {
    it(`registers module-level const for ${api}`, () => {
      const init =
        api === "signal"
          ? "0"
          : api === "createContext"
          ? "undefined"
          : api === "lazy"
          ? '() => import("./x")'
          : "() => {}"
      const vars = hotList(withApi(api, `const hot = ${api}(${init})\n`))
      assert.deepStrictEqual(vars, [{ type: api, name: "hot" }])
    })

    it(`registers export const for ${api}`, () => {
      const init =
        api === "signal"
          ? "0"
          : api === "createContext"
          ? "undefined"
          : api === "lazy"
          ? '() => import("./x")'
          : "() => {}"
      const vars = hotList(
        withApi(api, `export const exported = ${api}(${init})\n`)
      )
      assert.deepStrictEqual(vars, [{ type: api, name: "exported" }])
    })
  }

  it("registers signal nested in an object literal", () => {
    const vars = hotList(
      withApi("signal", "const state = { count: signal(0) }\n")
    )
    assert.deepStrictEqual(vars, [{ type: "signal", name: "state.count" }])
  })

  it("registers signal from a reassignment", () => {
    const vars = hotList(withApi("signal", "let count\n\ncount = signal(0)\n"))
    assert.deepStrictEqual(vars, [{ type: "signal", name: "count" }])
  })

  it("registers export function components", () => {
    const vars = hotList(`export function App() {}\n`)
    assert.deepStrictEqual(vars, [{ type: "component", name: "App" }])
  })

  it("registers export default function components", () => {
    const vars = hotList(`export default function Page() {}\n`)
    assert.deepStrictEqual(vars, [{ type: "component", name: "Page" }])
  })

  it("registers const function components", () => {
    const vars = hotList(`const Card = function() {}\n`)
    assert.deepStrictEqual(vars, [{ type: "component", name: "Card" }])
  })

  it("registers export const function components", () => {
    const vars = hotList(`export const Card = function() {}\n`)
    assert.deepStrictEqual(vars, [{ type: "component", name: "Card" }])
  })

  it("registers const arrow components", () => {
    const vars = hotList(`const Card = () => {}\n`)
    assert.deepStrictEqual(vars, [{ type: "component", name: "Card" }])
  })

  it("registers export const arrow components", () => {
    const vars = hotList(`export const Modal = () => {}\n`)
    assert.deepStrictEqual(vars, [{ type: "component", name: "Modal" }])
  })

  it("collects components and hot APIs in one module", () => {
    const vars = hotList(`
import { signal, effect } from "kiru"
export function App() {}
const count = signal(0)
const stop = effect(() => {})
`)
    assert.deepStrictEqual(vars, [
      { type: "component", name: "App" },
      { type: "signal", name: "count" },
      { type: "effect", name: "stop" },
    ])
  })

  it("ignores lowercase functions as components", () => {
    const vars = hotList(`function helper() {}\n`)
    assert.deepStrictEqual(vars, [])
  })

  it("ignores kiru calls without a hot-var parent stack", () => {
    const vars = hotList(withApi("signal", "function inner() { signal(0) }\n"))
    assert.deepStrictEqual(vars, [])
  })
})

describe("prepareHMR", () => {
  it("prepends prepare, appends accept, and registers hot vars", () => {
    const dir = mkdtempSync(join(tmpdir(), "kiru-hmr-"))
    const filePath = join(dir, "page.ts")
    const source = withApi("signal", "const count = signal(0)\n")
    const out = transformHMR(source, filePath)

    assert.match(out, /HMRContext\?\.prepare\(".*page\.ts"\)/)
    assert.match(out, /import\.meta\.hot\.accept\(\)/)
    assert.match(
      out,
      /"count":\s*\{[\s\S]*type: "signal"[\s\S]*value: count[\s\S]*link: "line:2"/
    )
  })

  it("injects moduleEffects preamble for top-level effect calls", () => {
    const dir = mkdtempSync(join(tmpdir(), "kiru-hmr-"))
    const filePath = join(dir, "effects.ts")
    const source = withApi("effect", "effect(() => {})\n")
    const out = transformHMR(source, filePath)

    assert.match(out, /moduleEffects\.registerNext\(\)/)
    assert.doesNotMatch(out, /type: "effect"/)
  })
})
