import { parseAst } from "rollup/parseAst"
import * as AST from "./ast.js"
import { MagicString, TransformCTX } from "./shared.js"
import {
  buildProgramBindingResolve,
  walkProgramBody,
} from "./scopeWalk.js"
import { isKiruJsxFactoryCall } from "./scope.js"
import { formatRegionsLiteral } from "./compileRegions.js"
import {
  bindingMatchesComponentRender,
  parseTemplateRefMarkers,
  serializeComponentLeafTemplate,
} from "./componentFold.js"
import {
  isTemplateShellEligibleCall,
  selectMaximalTemplateShellCalls,
  serializeJsxCallToTemplate,
  type TemplateSerializeCtx,
  type TemplateShellCallSite,
} from "./templateHTML.js"
import {
  buildTemplateFactoryExpr,
  htmlUsesTemplateRefs,
} from "./templateComposition.js"
import type { CompileRegion } from "kiru/template"

type AstNode = AST.AstNode

const TEMPLATE_IMPORT = `import { _template, createHoledTemplate } from "kiru/template";\n`

type TemplateBinding = {
  node: AstNode
  html: string
  holeCount: number
  holeNodes: AstNode[]
  regions: CompileRegion[]
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
    bodyNodes,
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

  const { bindings, refVarMap } = planTemplateBindings(
    selected,
    bodyNodes,
    analysis
  )

  if (bindings.length === 0) return

  const origSrc = code.toString()
  const hoistedVarByNode = findHoistedVarNames(bodyNodes, bindings)

  const moduleDecls: string[] = []
  for (const b of bindings) {
    if (hoistedVarByNode.has(b.node)) continue
    moduleDecls.push(templateDecl(b, refVarMap))
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
      `${b.varName} = ${templateDeclExpr(b, refVarMap)}` +
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

function planTemplateBindings(
  selected: { call: AstNode; result: { html: string; holeCount: number; holeNodes: AstNode[]; regions: CompileRegion[] } }[],
  bodyNodes: AstNode[],
  analysis: TemplateSerializeCtx
): { bindings: TemplateBinding[]; refVarMap: Map<string, string> } {
  let bindings: TemplateBinding[] = selected.map((s, i) => ({
    node: s.call,
    html: s.result.html,
    holeCount: s.result.holeCount,
    holeNodes: s.result.holeNodes,
    regions: s.result.regions,
    varName: `$t${i}`,
  }))

  const refNames = new Set<string>()
  for (const b of bindings) {
    for (const name of parseTemplateRefMarkers(b.html)) refNames.add(name)
  }

  for (const name of refNames) {
    const hasRenderBinding = bindings.some((b) =>
      bindingMatchesComponentRender(b.node, name, bodyNodes, analysis)
    )
    if (hasRenderBinding) continue
    const leaf = serializeComponentLeafTemplate(name, analysis, (jsx) =>
      serializeJsxCallToTemplate(jsx, analysis)
    )
    if (!leaf) continue
    const renderInit = findComponentRenderJsxNode(name, bodyNodes, analysis)
    bindings.push({
      node: renderInit ?? bindings[0]!.node,
      html: leaf.html,
      holeCount: 0,
      holeNodes: [],
      regions: [],
      varName: `$t${bindings.length}`,
    })
  }

  bindings.sort((a, b) => {
    const aLeaf = a.holeCount === 0 && !htmlUsesTemplateRefs(a.html)
    const bLeaf = b.holeCount === 0 && !htmlUsesTemplateRefs(b.html)
    if (aLeaf && !bLeaf) return -1
    if (bLeaf && !aLeaf) return 1
    return a.node.start - b.node.start
  })

  bindings = bindings.map((b, i) => ({ ...b, varName: `$t${i}` }))

  const refVarMap = new Map<string, string>()
  for (const name of refNames) {
    const match = bindings.find(
      (b) =>
        b.holeCount === 0 &&
        (bindingMatchesComponentRender(b.node, name, bodyNodes, analysis) ||
          serializeComponentLeafTemplate(name, analysis, (jsx) =>
            serializeJsxCallToTemplate(jsx, analysis)
          )?.html === b.html)
    )
    if (match) refVarMap.set(name, match.varName)
  }

  return { bindings, refVarMap }
}

function findComponentRenderJsxNode(
  componentName: string,
  bodyNodes: AstNode[],
  ctx: TemplateSerializeCtx
): AstNode | null {
  for (const stmt of bodyNodes) {
    const init = findBindingInitInStmt(stmt, componentName)
    if (!init) continue
    if (
      init.type === "ArrowFunctionExpression" ||
      init.type === "FunctionExpression"
    ) {
      const body = (init as { body?: AstNode }).body
      if (body?.type === "CallExpression") return body
      if (body?.type === "BlockStatement") {
        const stmts = (body as { body?: AstNode[] }).body
        const ret = stmts?.find((s) => s.type === "ReturnStatement")
        const arg = (ret as { argument?: AstNode } | undefined)?.argument
        if (arg?.type === "CallExpression") return arg
      }
    }
  }
  return null
}

function findBindingInitInStmt(stmt: AstNode, name: string): AstNode | null {
  if (stmt.type === "VariableDeclaration") {
    for (const decl of (stmt as { declarations?: AstNode[] }).declarations ?? []) {
      const id = (decl as { id?: AstNode }).id
      if (id?.type === "Identifier" && id.name === name) {
        return (decl as { init?: AstNode }).init ?? null
      }
    }
  }
  if (stmt.type === "ExportNamedDeclaration") {
    const decl = (stmt as { declaration?: AstNode }).declaration
    if (decl) return findBindingInitInStmt(decl, name)
  }
  return null
}

function templateDecl(b: TemplateBinding, refVarMap: Map<string, string>): string {
  return `const ${b.varName} = ${templateDeclExpr(b, refVarMap)}`
}

function templateDeclExpr(
  b: TemplateBinding,
  refVarMap: Map<string, string>
): string {
  return buildTemplateFactoryExpr(b.html, b.holeCount, refVarMap)
}

function templateUse(b: TemplateBinding, origSrc: string): string {
  if (b.holeCount === 0) return `${b.varName}()`
  const parts = b.holeNodes.map((n) => origSrc.slice(n.start, n.end))
  const regionsLit = formatRegionsLiteral(b.regions)
  const regionsArg = regionsLit ? `, ${regionsLit}` : ""
  return `createHoledTemplate(${b.varName}, [${parts.join(", ")}]${regionsArg})`
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
