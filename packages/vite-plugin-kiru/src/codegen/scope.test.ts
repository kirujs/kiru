import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import {
  ScopeStack,
  buildModuleImportScope,
  declareFunctionParamBindings,
  isImportedCall,
  isKiruJsxFactoryCall,
  matchesKiruJsxFactorySource,
  registerImportDeclaration,
} from "./scope.js"
import type { AstNode } from "./ast.js"

function parseProgram(source: string): AstNode[] {
  return parseAst(source, { allowReturnOutsideFunction: true }).body as AstNode[]
}

describe("scope", () => {
  it("resolves import aliases through shadowing", () => {
    const body = parseProgram(`
import { signal } from "kiru"

function MyComponent() {
  const _signal = signal
  _signal(0)
}
`)
    const scope = buildModuleImportScope(body)
    const resolve = (name: string) => scope.resolve(name)

    scope.push()
    scope.declare("_signal", {
      kind: "setupConst",
      name: "_signal",
    })

    assert.strictEqual(
      isImportedCall(
        {
          type: "CallExpression",
          callee: { type: "Identifier", name: "_signal" },
        } as AstNode,
        resolve,
        { imported: "signal", namespace: "kiru" }
      ),
      false
    )

    assert.strictEqual(
      isImportedCall(
        {
          type: "CallExpression",
          callee: { type: "Identifier", name: "signal" },
        } as AstNode,
        resolve,
        { imported: "signal", namespace: "kiru" }
      ),
      true
    )
    scope.pop()
  })

  it("registers aliased imports", () => {
    const body = parseProgram(`import { signal as s } from "kiru"`)
    const scope = buildModuleImportScope(body)
    const binding = scope.resolve("s")
    assert.ok(binding)
    assert.strictEqual(binding!.kind, "import")
    assert.strictEqual(binding!.import!.imported, "signal")
  })

  it("matches Vite-resolved kiru jsx.js for jsxDEV", () => {
    assert.ok(
      matchesKiruJsxFactorySource(
        "/@fs/C:/repos/kiru/kiru/packages/lib/dist/jsx.js",
        "jsxDEV"
      )
    )
  })

  it("isKiruJsxFactoryCall works with resolved jsxDEV import path", () => {
    const body = parseProgram(
      `import { jsxDEV } from "/@fs/C:/repos/kiru/kiru/packages/lib/dist/jsx.js"`
    )
    const scope = buildModuleImportScope(body)
    const resolve = (name: string) => scope.resolve(name)
    assert.ok(
      isKiruJsxFactoryCall(
        {
          type: "CallExpression",
          callee: { type: "Identifier", name: "jsxDEV" },
        } as AstNode,
        resolve,
        "jsxDEV"
      )
    )
  })

  it("registerImportDeclaration adds jsx-runtime imports", () => {
    const body = parseProgram(
      `import { jsx, jsxs } from "kiru/jsx-runtime"`
    )
    const scope = new ScopeStack()
    registerImportDeclaration(body[0]!, scope)
    assert.ok(scope.resolve("jsx")?.import)
    assert.strictEqual(scope.resolve("jsx")!.import!.source, "kiru/jsx-runtime")
  })

  it("declareFunctionParamBindings registers destructured params", () => {
    const body = parseProgram(`
import { jsxDEV } from "kiru/jsx-dev-runtime"

export default function Layout({ children }) {
  return jsxDEV("div", { children }, void 0, false, void 0, this)
}
`)
    const scope = buildModuleImportScope(body)
    scope.push()
    const fn = (
      body.find((n) => n.type === "ExportDefaultDeclaration") as {
        declaration: AstNode
      }
    ).declaration
    declareFunctionParamBindings(
      (fn as { params?: AstNode[] }).params,
      scope,
      "param"
    )
    assert.strictEqual(scope.resolve("children")?.kind, "param")
  })
})
