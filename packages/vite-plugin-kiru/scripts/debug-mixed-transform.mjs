import fs from "node:fs"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "../src/codegen/shared.js"
import { buildModuleImportScope, isKiruJsxFactoryCall, registerImportDeclaration } from "../src/codegen/scope.js"
import {
  isTemplateShellEligibleCall,
  serializeJsxCallToTemplate,
} from "../src/codegen/templateHTML.js"
import { applyJsxHoistAndTemplates } from "../src/codegen/jsxHoistPipeline.js"

const source = `
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
    { meta: { regions: [{ kind: "insert", slot: 1 }] } }
  )
`

const ast = parseAst(source, { allowReturnOutsideFunction: true })
const body = ast.body
const scope = buildModuleImportScope(body)
for (const n of body) {
  if (n.type === "ImportDeclaration") registerImportDeclaration(n, scope)
}
const resolve = (name) => scope.resolve(name)
const analysis = {
  resolve,
  isJsxProd: (n) => isKiruJsxFactoryCall(n, resolve, "jsx") || isKiruJsxFactoryCall(n, resolve, "jsxs"),
  isJsxs: (n) => isKiruJsxFactoryCall(n, resolve, "jsxs"),
  isJsxDev: (n) => isKiruJsxFactoryCall(n, resolve, "jsxDEV"),
}
let calls = 0
function walk(node) {
  if (node?.type === "CallExpression" && (analysis.isJsxProd(node) || analysis.isJsxDev(node))) {
    calls++
    const ok = isTemplateShellEligibleCall(node, analysis)
    const r = serializeJsxCallToTemplate(node, analysis)
    console.log("jsx", node.arguments?.[0]?.value, "shell", ok, "ser", !!r, r?.holeCount)
  }
  for (const k of Object.keys(node || {})) {
    const v = node[k]
    if (Array.isArray(v)) v.forEach(walk)
    else if (v?.type) walk(v)
  }
}
body.forEach(walk)
console.log("total jsx calls", calls)

const ctx = {
  code: new MagicString(source),
  ast,
  isBuild: false,
  fileLinkFormatter: (x) => x,
  filePath: "x",
  log: () => {},
}
try {
  applyJsxHoistAndTemplates(ctx)
} catch (e) {
  console.error("pipeline threw", e.message)
}
const out = ctx.code.toString()
console.log("len", out.length, "has template import", out.includes("_template"))
console.log("pos 280-320:", JSON.stringify(out.slice(280, 320)))
fs.writeFileSync("scripts/out-mixed.js", out)
console.log("wrote scripts/out-mixed.js, len", out.length)
try {
  parseAst(out, { allowReturnOutsideFunction: true })
  console.log("parse ok")
} catch (e) {
  console.error("parse fail", e.message)
  console.log(out.slice(0, 500))
}
