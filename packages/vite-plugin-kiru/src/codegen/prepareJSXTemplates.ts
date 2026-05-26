import { parseAst } from "rollup/parseAst"
import * as AST from "./ast.js"
import { MagicString, TransformCTX } from "./shared.js"
import {
  buildProgramBindingResolve,
  walkProgramBody,
} from "./scopeWalk.js"
import { isKiruJsxFactoryCall } from "./scope.js"
import {
  isTemplateShellEligibleCall,
  selectMaximalTemplateShellCalls,
  type TemplateSerializeCtx,
  type TemplateShellCallSite,
} from "./templateHTML.js"

type AstNode = AST.AstNode

const TEMPLATE_IMPORT = `import { _template, createHoledTemplate } from "kiru/template";\n`

type TemplateBinding = {
  node: AstNode
  html: string
  holeCount: number
  holeNodes: AstNode[]
  varName: string
}

export function prepareJSXTemplates(ctx: TransformCTX) {
  ctx.code = new MagicString(ctx.code.toString())
  let code = ctx.code
  const ast = parseAst(code.toString(), { allowReturnOutsideFunction: true })
  ctx.ast = ast
  const bodyNodes = ast.body as AstNode[]

  const resolve = buildProgramBindingResolve(bodyNodes)

  const analysis: TemplateSerializeCtx = {
    resolve,
    isJsxProd: (node) =>
      isKiruJsxFactoryCall(node, resolve, "jsx") ||
      isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxs: (node) => isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxDev: (node) => isKiruJsxFactoryCall(node, resolve, "jsxDEV"),
  }

  const calls: TemplateShellCallSite[] = []
  walkProgramBody(bodyNodes, {
    onCallExpression: (node, { fnDepth }) => {
      if (
        (analysis.isJsxProd(node) || analysis.isJsxDev(node)) &&
        isTemplateShellEligibleCall(node, analysis)
      ) {
        calls.push({ node, strictHoledShell: fnDepth >= 2 })
      }
    },
  })

  const selected = selectMaximalTemplateShellCalls(calls, analysis)
  if (selected.length === 0) return

  const bindings: TemplateBinding[] = []
  let counter = 0
  for (const { call: callNode, result } of selected) {
    bindings.push({
      node: callNode,
      html: result.html,
      holeCount: result.holeCount,
      holeNodes: result.holeNodes,
      varName: `$t${counter++}`,
    })
  }

  if (bindings.length === 0) return

  const origSrc = code.toString()
  const hoistedVarByNode = findHoistedVarNames(bodyNodes, bindings)

  const moduleDecls: string[] = []
  for (const b of bindings) {
    if (hoistedVarByNode.has(b.node)) continue
    moduleDecls.push(templateDecl(b))
  }

  const inline = bindings.filter((b) => !hoistedVarByNode.has(b.node))
  const hoisted = bindings.filter((b) => hoistedVarByNode.has(b.node))

  for (let i = inline.length - 1; i >= 0; i--) {
    const b = inline[i]!
    code.update(b.node.start, b.node.end, templateUse(b, origSrc))
  }

  if (moduleDecls.length > 0) {
    const minStart = Math.min(
      ...bindings
        .filter((b) => !hoistedVarByNode.has(b.node))
        .map((b) => b.node.start)
    )
    let insertPos = 0
    for (const node of bodyNodes) {
      if (node.end <= minStart) insertPos = Math.max(insertPos, node.end)
    }
    code.appendRight(insertPos, `\n${moduleDecls.join("\n")}\n`)
  }

  for (const b of hoisted) {
    const hoist = hoistedVarByNode.get(b.node)!
    let src = code.toString()
    src = src.replace(
      new RegExp(`\\n${escapeRegExp(hoist.varName)}\\.meta=\\{[^\\n]*\\}`, "g"),
      ""
    )
    src =
      src.slice(0, hoist.declStart) +
      `${b.varName} = ${templateDeclExpr(b)}` +
      src.slice(hoist.declEnd)
    src = src.replace(
      new RegExp(escapeRegExp(hoist.varName), "g"),
      templateUseIdentifier(b, origSrc)
    )
    code = ctx.code = new MagicString(src)
  }

  code.prepend(TEMPLATE_IMPORT)
  ctx.code = new MagicString(code.toString())
}

function templateDecl(b: TemplateBinding): string {
  return `const ${b.varName} = ${templateDeclExpr(b)}`
}

function templateDeclExpr(b: TemplateBinding): string {
  if (b.holeCount === 0) {
    return `_template(${JSON.stringify(b.html)})`
  }
  return `_template(${JSON.stringify(b.html)}, ${b.holeCount})`
}

function templateUse(b: TemplateBinding, origSrc: string): string {
  if (b.holeCount === 0) return `${b.varName}()`
  const parts = b.holeNodes.map((n) => origSrc.slice(n.start, n.end))
  return `createHoledTemplate(${b.varName}, [${parts.join(", ")}])`
}

function templateUseIdentifier(b: TemplateBinding, origSrc: string): string {
  return templateUse(b, origSrc)
}

function findHoistedVarNames(
  bodyNodes: AstNode[],
  bindings: TemplateBinding[]
): Map<AstNode, { varName: string; declStart: number; declEnd: number }> {
  const byNode = new Map(bindings.map((b) => [b.node, b] as const))
  const out = new Map<
    AstNode,
    { varName: string; declStart: number; declEnd: number }
  >()

  for (const stmt of bodyNodes) {
    visitModuleAst([stmt], (node) => {
      if (node.type !== "VariableDeclaration") return
      for (const decl of node.declarations ?? []) {
        if (decl.type !== "VariableDeclarator") continue
        const id = decl.id
        const init = decl.init as AstNode | undefined
        if (id?.type !== "Identifier" || !id.name || !init) continue
        if (!/^\$k\d+$/.test(id.name)) continue
        if (byNode.has(init)) {
          out.set(init, {
            varName: id.name,
            declStart: decl.start,
            declEnd: decl.end,
          })
        }
      }
    })
  }
  return out
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function visitModuleAst(nodes: AstNode[], fn: (n: AstNode) => void): void {
  const visit = (node: AstNode | null | undefined) => {
    if (!node || typeof node !== "object" || !("type" in node)) return
    fn(node)
    for (const key of Object.keys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key]
      if (Array.isArray(val)) {
        for (const c of val) visit(c as AstNode)
      } else if (val && typeof val === "object" && "type" in val) {
        visit(val as AstNode)
      }
    }
  }
  for (const n of nodes) visit(n)
}
