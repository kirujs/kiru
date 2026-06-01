import type { CompileRegion } from "kiru/template"
import {
  buildStructuralWalkFromMarkup,
  countStructuralWalkOps,
  StructuralWalkOp,
} from "kiru/template"
import { serializeStaticElementToHtml } from "kiru/utils"
import { sliceNode } from "../codegenPlan.js"
import { classifyTemplateHoleRegion } from "../compileRegions.js"
import {
  serializeJsxCallToTemplate,
  type TemplateBindingHost,
  type TemplateSerializeCtx,
  type TemplateSerializeResult,
} from "../templateHTML.js"
import { isCreateComponentCall, isForCall } from "./context.js"
import type * as AST from "../ast.js"
import { isKiruJsxFactoryCall } from "../scope.js"

type AstNode = AST.AstNode

export type DomTemplateDecl = {
  varName: string
  result: TemplateSerializeResult
}

export type EmitDomSetupResult = {
  templateDecl: DomTemplateDecl
  setupLines: string[]
  returnExpr: string
}

/** When install runs once, emitted getters read live props via setupDom().props. */
export type DomInstallEmitOptions = {
  livePropsInInstall?: boolean
  renderParamName?: string
}

function installExpr(expr: string, install?: DomInstallEmitOptions): string {
  if (!install?.livePropsInInstall) return expr
  const param = install.renderParamName ?? "props"
  if (!new RegExp(`\\b${escapeRegExp(param)}\\b`).test(expr)) return expr
  return expr
    .replace(
      new RegExp(`\\b${escapeRegExp(param)}\\.`, "g"),
      "setupDom().props."
    )
    .replace(
      new RegExp(`\\b${escapeRegExp(param)}\\[`, "g"),
      "setupDom().props["
    )
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function touchLiveProps(
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  if (install?.livePropsInInstall) neededImports.add("setupDom")
}

function escapeTemplateLiteral(html: string): string {
  return html.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$")
}

function formatTemplateDecl(varName: string, result: TemplateSerializeResult): string {
  const html = escapeTemplateLiteral(result.html)
  if (result.holeCount > 0) {
    return `const ${varName} = template(\`${html}\`, ${result.holeCount})`
  }
  return `const ${varName} = template(\`${html}\`)`
}

function propKeyName(prop: AstNode): string | null {
  const key = (prop as { key?: AstNode }).key
  if (!key) return null
  if (key.type === "Identifier") return key.name ?? null
  if (key.type === "Literal" && typeof key.value === "string") return key.value
  return null
}

function getJsxChildrenArg(call: AstNode): AstNode | null {
  const props = call.arguments?.[1]
  if (!props || props.type !== "ObjectExpression") return null
  for (const prop of props.properties ?? []) {
    if (prop.type !== "Property") continue
    if (propKeyName(prop) === "children") return prop.value as AstNode
  }
  return null
}

function collectStaticPropPairs(
  propsArg: AstNode | undefined | null,
  ctx: TemplateSerializeCtx
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!propsArg || propsArg.type !== "ObjectExpression") return out
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") continue
    const key = propKeyName(prop)
    if (
      !key ||
      key === "children" ||
      key === "key" ||
      key === "ref" ||
      key.startsWith("on") ||
      key.startsWith("bind:")
    ) {
      continue
    }
    const value = prop.value as AstNode
    if (value.type === "Literal") {
      out[key === "className" ? "class" : key] = value.value
    } else if (value.type === "Identifier" && ctx.domCodegen) {
      continue
    }
  }
  return out
}

function mergeChildTemplates(
  parts: TemplateSerializeResult[]
): TemplateSerializeResult {
  let holeNodes: AstNode[] = []
  let regions: CompileRegion[] = []
  let bindings: TemplateSerializeResult["bindings"] = []
  let bindingHosts: TemplateBindingHost[] = []
  let nodeOffset = 0
  let innerHtml = ""

  for (const part of parts) {
    innerHtml += part.html
    for (let i = 0; i < part.holeNodes.length; i++) {
      holeNodes.push(part.holeNodes[i]!)
      regions.push(part.regions[i] ?? { kind: "insert" })
    }
    for (let i = 0; i < part.bindings.length; i++) {
      const b = part.bindings[i]!
      bindings.push({ ...b, nodeIndex: b.nodeIndex + nodeOffset })
      const host = part.bindingHosts[i]
      if (host) {
        bindingHosts.push({ ...host, nodeIndex: host.nodeIndex + nodeOffset })
      }
    }
    nodeOffset += part.structuralNodeCount
  }

  return {
    html: innerHtml,
    holeCount: holeNodes.length,
    holeNodes,
    regions,
    bindings,
    bindingHosts,
    structuralNodeCount: nodeOffset,
    structuralWalk: buildStructuralWalkFromMarkup(innerHtml, {
      excludeShellRoot: true,
    }),
  }
}

function serializeDomRoot(
  jsxRoot: AstNode,
  ctx: TemplateSerializeCtx
): TemplateSerializeResult | null {
  return serializeJsxCallToTemplate(jsxRoot, ctx)
}

function jsxTagName(call: AstNode): string | null {
  const typeArg = call.arguments?.[0]
  if (typeArg?.type === "Literal" && typeof typeArg.value === "string") {
    return typeArg.value
  }
  return null
}

export function isComponentJsxCall(node: AstNode, ctx: TemplateSerializeCtx): boolean {
  if (
    !isKiruJsxFactoryCall(node, ctx.resolve, "jsx") &&
    !isKiruJsxFactoryCall(node, ctx.resolve, "jsxs") &&
    !isKiruJsxFactoryCall(node, ctx.resolve, "jsxDEV")
  ) {
    return false
  }
  const typeArg = node.arguments?.[0]
  if (typeArg?.type === "Identifier") {
    const name = typeArg.name ?? ""
    return name.charAt(0) === name.charAt(0).toUpperCase()
  }
  const tag = jsxTagName(node)
  return tag !== null && tag.charAt(0) === tag.charAt(0).toUpperCase()
}

function unwrapFunctionExpressionBody(node: AstNode): AstNode | null {
  if (
    node.type !== "ArrowFunctionExpression" &&
    node.type !== "FunctionExpression"
  ) {
    return null
  }
  const body = (node as { body?: AstNode }).body
  if (!body) return null
  if (body.type === "BlockStatement") {
    const ret = (body as { body?: AstNode[] }).body?.find(
      (s) => s.type === "ReturnStatement"
    )
    return (ret as { argument?: AstNode })?.argument ?? null
  }
  return body
}

function unwrapJsxBody(node: AstNode): AstNode {
  return node.type === "ParenthesizedExpression"
    ? ((node as { expression?: AstNode }).expression ?? node)
    : node
}

function isFragmentJsxCall(node: AstNode, ctx: TemplateSerializeCtx): boolean {
  if (!isAnyJsxFactoryCall(node, ctx)) return false
  const typeArg = node.arguments?.[0]
  return typeArg?.type === "Identifier" && typeArg.name === "Fragment"
}

function getFragmentChildNodes(fragmentCall: AstNode): AstNode[] {
  const children = getJsxChildrenArg(fragmentCall)
  if (!children) return []
  if (children.type === "ArrayExpression") {
    return ((children as { elements?: (AstNode | null)[] }).elements ?? []).filter(
      (el): el is AstNode => el !== null && el !== undefined
    )
  }
  return [children]
}

function isCompilableJsxRoot(node: AstNode, ctx: TemplateSerializeCtx): boolean {
  if (!isAnyJsxFactoryCall(node, ctx)) return false
  if (isFragmentJsxCall(node, ctx)) return true
  if (isComponentJsxCall(node, ctx)) return true
  return serializeJsxCallToTemplate(node, ctx) !== null
}

function isJsxFnPropValue(node: AstNode, ctx: TemplateSerializeCtx): boolean {
  const body = unwrapFunctionExpressionBody(node)
  if (!body) return false
  return isCompilableJsxRoot(unwrapJsxBody(body), ctx)
}

function propsNeedCompilation(
  propsArg: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (propsArg.type !== "ObjectExpression") return false
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") continue
    const value = prop.value as AstNode
    if (isAnyJsxFactoryCall(value, ctx)) return true
    if (isJsxFnPropValue(value, ctx)) return true
  }
  return false
}

function compileJsxPropValue(
  jsxNode: AstNode,
  source: string,
  ctx: TemplateSerializeCtx,
  templateDecls: DomTemplateDecl[],
  nextTemplateId: { n: number },
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): string {
  const compiled = compileJsxContent(
    jsxNode,
    source,
    ctx,
    templateDecls,
    nextTemplateId,
    neededImports,
    install
  )
  return compileJsxContentToExpr(compiled)
}

function normalizeFragmentReturn(childExprs: string[]): string {
  if (childExprs.length === 0) return "undefined"
  if (childExprs.length === 1) return childExprs[0]!
  return `[${childExprs.join(", ")}]`
}

function compileJsxContentToExpr(compiled: {
  setupLines: string[]
  returnExpr: string
}): string {
  if (compiled.setupLines.length === 0) {
    return compiled.returnExpr
  }
  return `(function() {\n    ${compiled.setupLines.join("\n    ")}\n    return ${compiled.returnExpr}\n  })()`
}

function compileJsxContent(
  node: AstNode,
  source: string,
  ctx: TemplateSerializeCtx,
  templateDecls: DomTemplateDecl[],
  nextTemplateId: { n: number },
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): { setupLines: string[]; returnExpr: string } {
  const jsx = unwrapJsxBody(node)

  if (isFragmentJsxCall(jsx, ctx)) {
    const childNodes = getFragmentChildNodes(jsx)
    const childExprs: string[] = []
    for (const child of childNodes) {
      const part = compileJsxContent(
        child,
        source,
        ctx,
        templateDecls,
        nextTemplateId,
        neededImports,
        install
      )
      childExprs.push(compileJsxContentToExpr(part))
    }
    return {
      setupLines: [],
      returnExpr: normalizeFragmentReturn(childExprs),
    }
  }

  if (isComponentJsxCall(jsx, ctx)) {
    return {
      setupLines: [],
      returnExpr: factoryResultExpr(
        jsx,
        source,
        ctx,
        templateDecls,
        nextTemplateId,
        neededImports,
        install
      ),
    }
  }

  const inner = emitDomSetupFromJsx(
    jsx,
    source,
    ctx,
    templateDecls,
    nextTemplateId,
    neededImports,
    install
  )
  return { setupLines: inner.setupLines, returnExpr: inner.returnExpr }
}

function formatFnParams(params: AstNode[], source: string): string {
  return params
    .map((p) => sliceNode(source, p).trim())
    .filter(Boolean)
    .join(", ")
}

function compileJsxFnProp(
  fnNode: AstNode,
  source: string,
  ctx: TemplateSerializeCtx,
  templateDecls: DomTemplateDecl[],
  nextTemplateId: { n: number },
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): string {
  const params = (fnNode as { params?: AstNode[] }).params ?? []
  const paramList = formatFnParams(params, source)
  const body = unwrapFunctionExpressionBody(fnNode)
  if (!body || !isJsxFnPropValue(fnNode, ctx)) {
    return sliceNode(source, fnNode).trim()
  }

  const jsxRoot = unwrapJsxBody(body)
  const compiled = compileJsxContent(
    jsxRoot,
    source,
    ctx,
    templateDecls,
    nextTemplateId,
    neededImports,
    install
  )

  if (compiled.returnExpr === "undefined") {
    return `(${paramList}) => undefined`
  }

  if (isFragmentJsxCall(jsxRoot, ctx) && compiled.returnExpr.startsWith("[")) {
    return `(${paramList}) => ${compiled.returnExpr}`
  }

  if (compiled.setupLines.length === 0 && !compiled.returnExpr.startsWith("[")) {
    neededImports.add("createComponent")
    return `(${paramList}) => createComponent(() => {\n    return ${compiled.returnExpr}\n  }, {})`
  }

  neededImports.add("createComponent")
  return `(${paramList}) => createComponent(() => {\n    ${compiled.setupLines.join("\n    ")}\n    return ${compiled.returnExpr}\n  }, {})`
}

function isAbsentJsxKeyArg(node: AstNode | undefined | null): boolean {
  if (node === undefined || node === null) return true
  if (node.type === "Literal") return true
  if (node.type === "Identifier" && node.name === "undefined") return true
  if (node.type === "UnaryExpression") {
    const op = (node as { operator?: string }).operator
    const arg = (node as { argument?: AstNode }).argument
    return op === "void" && arg?.type === "Literal" && arg.value === 0
  }
  return false
}

function jsxCallKeyExpr(call: AstNode, source: string): string | null {
  const keyArg = call.arguments?.[2]
  if (isAbsentJsxKeyArg(keyArg)) return null
  return sliceNode(source, keyArg as AstNode).trim()
}

function compileComponentProps(
  propsArg: AstNode | undefined | null,
  source: string,
  ctx: TemplateSerializeCtx,
  templateDecls: DomTemplateDecl[],
  nextTemplateId: { n: number },
  neededImports: Set<string>,
  jsxCall?: AstNode,
  install?: DomInstallEmitOptions
): string {
  if (!propsArg || propsArg.type !== "ObjectExpression") return "{}"
  if (!propsNeedCompilation(propsArg, ctx)) {
    const base = sliceNode(source, propsArg).trim()
    const keyExpr = jsxCall ? jsxCallKeyExpr(jsxCall, source) : null
    if (!keyExpr) return base
    if (base === "{}") return `{ key: ${keyExpr} }`
    return base.replace(/^\{/, `{ key: ${keyExpr}, `)
  }

  const parts: string[] = []
  const keyFromCall = jsxCall ? jsxCallKeyExpr(jsxCall, source) : null
  if (keyFromCall) {
    parts.push(`key: ${keyFromCall}`)
  }

  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") continue
    const key = propKeyName(prop)
    if (!key || key === "key") continue
    const value = prop.value as AstNode

    if (isJsxFnPropValue(value, ctx)) {
      parts.push(
        `${key}: ${compileJsxFnProp(value, source, ctx, templateDecls, nextTemplateId, neededImports, install)}`
      )
      continue
    }
    if (isAnyJsxFactoryCall(value, ctx)) {
      parts.push(
        `${key}: ${compileJsxPropValue(value, source, ctx, templateDecls, nextTemplateId, neededImports, install)}`
      )
      continue
    }
    parts.push(`${key}: ${sliceNode(source, value).trim()}`)
  }

  return `{\n  ${parts.join(",\n  ")},\n}`
}

function componentJsxName(node: AstNode): string | null {
  const typeArg = node.arguments?.[0]
  if (typeArg?.type === "Identifier") return typeArg.name ?? null
  return jsxTagName(node)
}

function emitComponentAtAnchor(
  node: AstNode,
  anchorIndex: number,
  projVar: string,
  source: string,
  ctx: TemplateSerializeCtx,
  lines: string[],
  templateDecls: DomTemplateDecl[],
  nextTemplateId: { n: number },
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  neededImports.add("createComponent")
  const anchor = `${projVar}.anchors[${anchorIndex}]`

  if (isCreateComponentCall(node, ctx.resolve)) {
    const expr = sliceNode(source, node).trim()
    lines.push(`${expr.slice(0, -1)}, ${anchor})`)
    return
  }

  const name = componentJsxName(node)
  if (!name) return
  const propsArg = node.arguments?.[1]
  const props = compileComponentProps(
    propsArg,
    source,
    ctx,
    templateDecls,
    nextTemplateId,
    neededImports,
    node
  )
  lines.push(`createComponent(${name}, ${props}, ${anchor})`)
}

function collectOrderedJsxCalls(jsxRoot: AstNode, ctx: TemplateSerializeCtx): AstNode[] {
  if (isKiruJsxFactoryCall(jsxRoot, ctx.resolve, "jsxs")) {
    const children = getJsxChildrenArg(jsxRoot)
    if (children?.type === "ArrayExpression") {
      return (children.elements ?? []).filter(
        (el): el is AstNode => !!el && isAnyJsxFactoryCall(el, ctx)
      )
    }
  }
  if (isAnyJsxFactoryCall(jsxRoot, ctx)) {
    return [jsxRoot]
  }
  return []
}

function isDomComponentHole(node: AstNode, ctx: TemplateSerializeCtx): boolean {
  if (isCreateComponentCall(node, ctx.resolve)) return true
  return isComponentJsxCall(node, ctx)
}

function isDomTextInsert(node: AstNode, ctx: TemplateSerializeCtx): boolean {
  if (node.type === "ArrayExpression") return true
  if (node.type === "MemberExpression") return true
  if (node.type === "ConditionalExpression") return true
  if (node.type === "LogicalExpression") return true
  if (node.type === "CallExpression" && !isAnyJsxFactoryCall(node, ctx)) return true
  return classifyTemplateHoleRegion(node, ctx, 0).kind === "text"
}

function isAnyJsxFactoryCall(
  node: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  return (
    isKiruJsxFactoryCall(node, ctx.resolve, "jsx") ||
    isKiruJsxFactoryCall(node, ctx.resolve, "jsxs") ||
    isKiruJsxFactoryCall(node, ctx.resolve, "jsxDEV")
  )
}

function resolveBindingNodeRef(
  result: TemplateSerializeResult,
  projVar: string,
  elVar: string,
  nodeIndex: number
): string {
  if (
    result.structuralNodeCount === 0 ||
    nodeIndex >= result.structuralNodeCount
  ) {
    return elVar
  }
  return `${projVar}.nodes[${nodeIndex}]`
}

function emitEventsFromJsxCall(
  call: AstNode,
  nodeIndex: number,
  source: string,
  projVar: string,
  lines: string[],
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  emitEventsFromJsxCallRef(
    call,
    `${projVar}.nodes[${nodeIndex}]`,
    source,
    lines,
    neededImports,
    install
  )
}

function emitEventsFromJsxCallRef(
  call: AstNode,
  nodeRef: string,
  source: string,
  lines: string[],
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  const props = call.arguments?.[1]
  if (!props || props.type !== "ObjectExpression") return
  for (const prop of props.properties ?? []) {
    if (prop.type !== "Property") continue
    const key = propKeyName(prop)
    if (!key?.startsWith("on")) continue
    neededImports.add("on")
    const evt = key.slice(2).toLowerCase()
    touchLiveProps(neededImports, install)
    const expr = installExpr(
      sliceNode(source, prop.value as AstNode).trim(),
      install
    )
    lines.push(`on(${nodeRef}, ${JSON.stringify(evt)}, ${expr})`)
  }
}

function emitTextFromJsxCall(
  call: AstNode,
  nodeIndex: number,
  source: string,
  projVar: string,
  lines: string[],
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  const children = getJsxChildrenArg(call)
  if (!children) return
  if (children.type === "CallExpression") {
    neededImports.add("insertText")
    touchLiveProps(neededImports, install)
    const expr = installExpr(sliceNode(source, children).trim(), install)
    lines.push(
      `insertText(${projVar}.nodes[${nodeIndex}], () => ${expr})`
    )
  }
}

function emitAttrEffectsFromJsxCall(
  call: AstNode,
  nodeIndex: number,
  source: string,
  projVar: string,
  lines: string[],
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  emitAttrEffectsFromJsxCallRef(
    call,
    `${projVar}.nodes[${nodeIndex}]`,
    source,
    lines,
    neededImports,
    install
  )
}

function emitAttrEffectsFromJsxCallRef(
  call: AstNode,
  nodeRef: string,
  source: string,
  lines: string[],
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  const props = call.arguments?.[1]
  if (!props || props.type !== "ObjectExpression") return
  for (const prop of props.properties ?? []) {
    if (prop.type !== "Property") continue
    const key = propKeyName(prop)
    if (key === "checked") {
      neededImports.add("domEffect")
      touchLiveProps(neededImports, install)
      const expr = installExpr(
        sliceNode(source, prop.value as AstNode).trim(),
        install
      )
      lines.push(
        `domEffect(() => { const __el = ${nodeRef}; if (__el instanceof HTMLInputElement) __el.checked = !!(${expr}) })`
      )
    }
  }
}

function emitOrderedJsxBindings(
  jsxRoot: AstNode,
  source: string,
  projVar: string,
  lines: string[],
  ctx: TemplateSerializeCtx,
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  const calls = collectOrderedJsxCalls(jsxRoot, ctx)
  if (calls.length === 0) {
    collectIntrinsicJsxCalls(jsxRoot, ctx, calls)
  }
  for (let i = 0; i < calls.length; i++) {
    emitTextFromJsxCall(
      calls[i]!,
      i,
      source,
      projVar,
      lines,
      neededImports,
      install
    )
    emitEventsFromJsxCall(
      calls[i]!,
      i,
      source,
      projVar,
      lines,
      neededImports,
      install
    )
    emitAttrEffectsFromJsxCall(
      calls[i]!,
      i,
      source,
      projVar,
      lines,
      neededImports,
      install
    )
  }
}

function collectIntrinsicJsxCalls(
  root: AstNode,
  ctx: TemplateSerializeCtx,
  out: AstNode[]
): void {
  if (!isAnyJsxFactoryCall(root, ctx)) {
    return
  }
  const tag = root.arguments?.[0]
  const children = getJsxChildrenArg(root)
  if (children?.type === "ArrayExpression") {
    for (const el of children.elements ?? []) {
      if (el) collectIntrinsicJsxCalls(el, ctx, out)
    }
    return
  }
  if (children) {
    collectIntrinsicJsxCalls(children, ctx, out)
    return
  }
  if (tag?.type === "Literal" && typeof tag.value === "string") {
    out.push(root)
  }
}

function emitDynamicRootProps(
  propsArg: AstNode | undefined | null,
  source: string,
  elVar: string,
  ctx: TemplateSerializeCtx,
  lines: string[],
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  if (!propsArg || propsArg.type !== "ObjectExpression") return
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") continue
    const key = propKeyName(prop)
    if (
      !key ||
      key === "children" ||
      key === "key" ||
      key === "ref" ||
      key.startsWith("on") ||
      key.startsWith("bind:")
    ) {
      continue
    }
    const value = prop.value as AstNode
    if (value.type === "Literal") continue
    touchLiveProps(neededImports, install)
    const expr = installExpr(sliceNode(source, value).trim(), install)
    const attr = key === "className" ? "class" : key
    if (value.type === "Identifier") {
      lines.push(`if (${expr}) ${elVar}.setAttribute(${JSON.stringify(attr)}, String(${expr}))`)
    } else {
      lines.push(`${elVar}.setAttribute(${JSON.stringify(attr)}, String(${expr}))`)
    }
  }
}

function emitBehaviorBinding(
  binding: { kind: string; prop: string; nodeIndex: number },
  host: TemplateBindingHost,
  source: string,
  projVar: string,
  lines: string[],
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  const nodeRef = `${projVar}.nodes[${binding.nodeIndex}]`
  const props = host.call.arguments?.[1]
  if (!props || props.type !== "ObjectExpression") return
  const propNode = (props.properties ?? []).find(
    (p) => p.type === "Property" && propKeyName(p) === binding.prop
  )
  if (!propNode || propNode.type !== "Property") return
  touchLiveProps(neededImports, install)
  const expr = installExpr(
    sliceNode(source, propNode.value as AstNode).trim(),
    install
  )

  if (binding.kind === "bind") {
    const attr = binding.prop.slice(5)
    if (attr === "value") {
      neededImports.add("bindValue")
      lines.push(`bindValue(${nodeRef}, ${expr})`)
    } else if (attr === "checked") {
      neededImports.add("bindChecked")
      lines.push(`bindChecked(${nodeRef}, ${expr})`)
    } else {
      neededImports.add("bindProp")
      lines.push(`bindProp(${nodeRef}, ${JSON.stringify(attr)}, ${expr})`)
    }
    return
  }

  if (binding.kind === "event") {
    neededImports.add("on")
    let evt = binding.prop
    if (evt.startsWith("on")) {
      evt = evt.slice(2).toLowerCase()
    }
    lines.push(`on(${nodeRef}, ${JSON.stringify(evt)}, ${expr})`)
  }
}

function resolveTextBindingTarget(
  elVar: string,
  projVar: string,
  result: TemplateSerializeResult,
  nodeIndex: number
): string {
  if (
    result.structuralNodeCount === 0 ||
    nodeIndex >= result.structuralNodeCount
  ) {
    return elVar
  }
  return `${projVar}.nodes[${nodeIndex}]`
}

function emitTextBinding(
  node: AstNode,
  source: string,
  nodeIndex: number,
  elVar: string,
  projVar: string,
  result: TemplateSerializeResult,
  lines: string[],
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  neededImports.add("insertText")
  touchLiveProps(neededImports, install)
  const target = resolveTextBindingTarget(elVar, projVar, result, nodeIndex)
  if (node.type === "ArrayExpression") {
    const parts = ((node as { elements?: (AstNode | null)[] }).elements ?? [])
      .filter(Boolean)
      .map(
        (el) =>
          `String(${installExpr(sliceNode(source, el as AstNode).trim(), install)})`
      )
    lines.push(`insertText(${target}, () => ${parts.join(" + ")})`)
    return
  }
  const expr = installExpr(sliceNode(source, node).trim(), install)
  lines.push(`insertText(${target}, () => String(${expr}))`)
}

function isDomTextExpression(
  node: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  if (isDomComponentHole(node, ctx)) return false
  if (isForCall(node, ctx.resolve)) return false
  if (node.type === "ConditionalExpression") {
    const cons = (node as { consequent?: AstNode }).consequent
    const alt = (node as { alternate?: AstNode }).alternate
    return (
      !!cons &&
      !!alt &&
      isDomTextExpression(cons, ctx) &&
      isDomTextExpression(alt, ctx)
    )
  }
  if (node.type === "Literal") {
    return typeof (node as { value?: unknown }).value === "string"
  }
  if (node.type === "TemplateLiteral") return true
  if (node.type === "ArrayExpression") return true
  if (node.type === "MemberExpression") return true
  if (node.type === "CallExpression") {
    if (isAnyJsxFactoryCall(node, ctx)) return false
    return true
  }
  if (node.type === "Identifier") return true
  return false
}

function emitConditionalHole(
  node: AstNode,
  source: string,
  anchorIndex: number,
  elVar: string,
  projVar: string,
  lines: string[],
  ctx: TemplateSerializeCtx,
  neededImports: Set<string>,
  templateDecls: DomTemplateDecl[],
  nextTemplateId: { n: number },
  result: TemplateSerializeResult,
  jsxRoot: AstNode,
  install?: DomInstallEmitOptions
): void {
  neededImports.add("domShow")
  const anchor = `${projVar}.anchors[${anchorIndex}]`

  if (node.type === "LogicalExpression") {
    const op = (node as { operator?: string }).operator
    const right = (node as { right?: AstNode }).right
    const left = (node as { left?: AstNode }).left
    if (op === "&&" && left && right) {
      const cond = sliceNode(source, left).trim()
      const factory = emitComponentFactory(
        right,
        source,
        ctx,
        templateDecls,
        nextTemplateId,
        neededImports,
        install
      )
      lines.push(`domShow(() => ${cond}, ${anchor}, ${factory})`)
      return
    }
  }

  if (node.type === "ConditionalExpression" && isDomTextExpression(node, ctx)) {
    neededImports.delete("domShow")
    neededImports.add("insertText")
    const nodeIndex = findTextHoleNodeIndex(result, anchorIndex, jsxRoot, node, ctx)
    const target = resolveTextBindingTarget(elVar, projVar, result, nodeIndex)
    touchLiveProps(neededImports, install)
    const expr = installExpr(sliceNode(source, node).trim(), install)
    lines.push(`insertText(${target}, () => String(${expr}))`)
    return
  }

  if (node.type === "ConditionalExpression") {
    neededImports.delete("domShow")
    neededImports.add("domEffect")
    neededImports.add("createRegion")
    const test = sliceNode(source, (node as { test?: AstNode }).test!).trim()
    const cons = (node as { consequent?: AstNode }).consequent!
    const alt = (node as { alternate?: AstNode }).alternate!
    const consCall = factoryResultExpr(
      cons,
      source,
      ctx,
      templateDecls,
      nextTemplateId,
      neededImports,
      install
    )
    const altCall = factoryResultExpr(
      alt,
      source,
      ctx,
      templateDecls,
      nextTemplateId,
      neededImports,
      install
    )
    lines.push(`const __region = createRegion(${anchor})`)
    lines.push(`domEffect(() => {`)
    lines.push(`  if (${test}) {`)
    lines.push(`    __region.mount(${consCall})`)
    lines.push(`    return () => __region.unmount()`)
    lines.push(`  }`)
    lines.push(`  __region.mount(${altCall})`)
    lines.push(`  return () => __region.unmount()`)
    lines.push(`})`)
    return
  }

  const factory = emitComponentFactory(
    node,
    source,
    ctx,
    templateDecls,
    nextTemplateId,
    neededImports,
    install
  )
  lines.push(`domShow(() => true, ${anchor}, ${factory})`)
}

function factoryResultExpr(
  node: AstNode,
  source: string,
  ctx: TemplateSerializeCtx,
  templateDecls: DomTemplateDecl[],
  nextTemplateId: { n: number },
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): string {
  if (isCreateComponentCall(node, ctx.resolve)) {
    return sliceNode(source, node).trim()
  }
  if (node.type === "CallExpression") {
    const callee = node.callee as AstNode
    if (callee?.type === "Identifier" && callee.name?.startsWith("create")) {
      return sliceNode(source, node).trim()
    }
  }
  if (node.type === "Identifier") {
    neededImports.add("createComponent")
    return `createComponent(${node.name}, {})`
  }
  if (isComponentJsxCall(node, ctx)) {
    const name = componentJsxName(node)
    if (!name) return sliceNode(source, node).trim()
    const propsArg = node.arguments?.[1]
    const props = compileComponentProps(
      propsArg,
      source,
      ctx,
      templateDecls,
      nextTemplateId,
      neededImports,
      node
    )
    neededImports.add("createComponent")
    return `createComponent(${name}, ${props})`
  }
  if (isCompilableJsxRoot(node, ctx)) {
    const compiled = compileJsxContent(
      node,
      source,
      ctx,
      templateDecls,
      nextTemplateId,
      neededImports,
      install
    )
    return compileJsxContentToExpr(compiled)
  }
  return sliceNode(source, node).trim()
}

function emitComponentFactory(
  node: AstNode,
  source: string,
  ctx: TemplateSerializeCtx,
  templateDecls: DomTemplateDecl[],
  nextTemplateId: { n: number },
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): string {
  if (isComponentJsxCall(node, ctx)) {
    neededImports.add("createComponent")
    return `() => ${factoryResultExpr(
      node,
      source,
      ctx,
      templateDecls,
      nextTemplateId,
      neededImports,
      install
    )}`
  }
  if (isCompilableJsxRoot(node, ctx)) {
    const emitted = emitDomSetupFromJsx(
      node,
      source,
      ctx,
      templateDecls,
      nextTemplateId,
      neededImports,
      install
    )
    const extraLines: string[] = []
    const projLine = emitted.setupLines.find((l) => l.includes("= project("))
    const projVar = projLine?.match(/(\$n\d+)\s*=/)?.[1] ?? "$n0"
    const nodeRef = resolveBindingNodeRef(
      emitted.templateDecl.result,
      projVar,
      emitted.returnExpr,
      0
    )
    emitEventsFromJsxCallRef(
      node,
      nodeRef,
      source,
      extraLines,
      neededImports,
      install
    )
    emitAttrEffectsFromJsxCallRef(
      node,
      nodeRef,
      source,
      extraLines,
      neededImports
    )
    const allLines = [...emitted.setupLines, ...extraLines]
    if (allLines.length === 0) {
      return `() => ${emitted.returnExpr}`
    }
    return `() => {\n    ${allLines.join("\n    ")}\n    return ${emitted.returnExpr}\n  }`
  }
  const result = factoryResultExpr(
    node,
    source,
    ctx,
    templateDecls,
    nextTemplateId,
    neededImports,
    install
  )
  return `() => ${result}`
}

function emitHole(
  node: AstNode,
  region: CompileRegion,
  anchorIndex: number,
  holeIndex: number,
  source: string,
  elVar: string,
  projVar: string,
  lines: string[],
  ctx: TemplateSerializeCtx,
  templateDecls: DomTemplateDecl[],
  nextTemplateId: { n: number },
  neededImports: Set<string>,
  result: TemplateSerializeResult,
  jsxRoot: AstNode,
  install?: DomInstallEmitOptions
): void {
  if (region.kind === "conditional") {
    emitConditionalHole(
      node,
      source,
      anchorIndex,
      elVar,
      projVar,
      lines,
      ctx,
      neededImports,
      templateDecls,
      nextTemplateId,
      result,
      jsxRoot,
      install
    )
    return
  }

  if (region.kind === "component" || isDomComponentHole(node, ctx)) {
    emitComponentAtAnchor(
      node,
      anchorIndex,
      projVar,
      source,
      ctx,
      lines,
      templateDecls,
      nextTemplateId,
      neededImports,
      install
    )
    return
  }

  if (region.kind === "text" || (region.kind === "insert" && isDomTextInsert(node, ctx))) {
    const nodeIndex = findTextHoleNodeIndex(result, anchorIndex, jsxRoot, node, ctx)
    emitTextBinding(
      node,
      source,
      nodeIndex,
      elVar,
      projVar,
      result,
      lines,
      neededImports,
      install
    )
    return
  }
}

function findTextHoleNodeIndex(
  result: TemplateSerializeResult,
  anchorIndex: number,
  jsxRoot: AstNode,
  node: AstNode,
  ctx: TemplateSerializeCtx
): number {
  const parentIndex = findParentElementNodeIndex(jsxRoot, node, ctx)
  if (parentIndex >= 0) {
    return Math.min(parentIndex, Math.max(0, result.structuralNodeCount - 1))
  }
  return Math.max(
    0,
    Math.min(
      result.structuralNodeCount - 1,
      result.structuralNodeCount - 1 - (result.holeCount - 1 - anchorIndex)
    )
  )
}

function findListContainerIndex(
  result: TemplateSerializeResult,
  holeIndex: number,
  jsxRoot: AstNode,
  ctx: TemplateSerializeCtx
): number {
  const forNode = result.holeNodes[holeIndex]
  if (!forNode) return Math.max(0, result.structuralNodeCount - 1)
  const parentIndex = findParentElementNodeIndex(jsxRoot, forNode, ctx)
  if (parentIndex >= 0) return parentIndex
  return Math.max(0, result.structuralNodeCount - 1)
}

function emitDynamicAttrsFromJsxCall(
  call: AstNode,
  nodeIndex: number,
  source: string,
  projVar: string,
  lines: string[],
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  const props = call.arguments?.[1]
  if (!props || props.type !== "ObjectExpression") return
  for (const prop of props.properties ?? []) {
    if (prop.type !== "Property") continue
    const key = propKeyName(prop)
    if (
      !key ||
      key === "children" ||
      key === "key" ||
      key === "ref" ||
      key.startsWith("on") ||
      key.startsWith("bind:") ||
      key === "class" ||
      key === "className" ||
      key === "checked"
    ) {
      continue
    }
    const value = prop.value as AstNode
    if (value.type === "Literal") continue
    neededImports.add("domEffect")
    touchLiveProps(neededImports, install)
    const expr = installExpr(sliceNode(source, value).trim(), install)
    const attr = key === "className" ? "class" : key
    const nodeRef = `${projVar}.nodes[${nodeIndex}]`
    if (value.type === "Identifier") {
      lines.push(
        `domEffect(() => { const __v = ${expr}; if (__v != null && __v !== false) ${nodeRef}.setAttribute(${JSON.stringify(attr)}, String(__v)) })`
      )
    } else {
      lines.push(
        `domEffect(() => { ${nodeRef}.setAttribute(${JSON.stringify(attr)}, String(${expr})) })`
      )
    }
  }
}

function emitDynamicClassEffectsFromJsxCall(
  call: AstNode,
  nodeIndex: number,
  source: string,
  projVar: string,
  lines: string[],
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): void {
  const props = call.arguments?.[1]
  if (!props || props.type !== "ObjectExpression") return
  for (const prop of props.properties ?? []) {
    if (prop.type !== "Property") continue
    const key = propKeyName(prop)
    if (key !== "class" && key !== "className") continue
    const value = prop.value as AstNode
    if (value.type === "Literal") continue
    neededImports.add("domEffect")
    touchLiveProps(neededImports, install)
    const expr = installExpr(sliceNode(source, value).trim(), install)
    const attr = key === "className" ? "class" : key
    lines.push(
      `domEffect(() => { ${projVar}.nodes[${nodeIndex}].setAttribute(${JSON.stringify(attr)}, String(${expr})) })`
    )
  }
}

function findParentElementNodeIndex(
  root: AstNode,
  target: AstNode,
  ctx: TemplateSerializeCtx
): number {
  let found = -1
  let elementCounter = -1

  function walkChildren(
    children: AstNode | undefined,
    _parentCall: AstNode
  ): boolean {
    if (!children) return false
    if (children === target) {
      found = elementCounter
      return true
    }
    const visit = (child: AstNode): boolean => {
      if (child === target) {
        found = elementCounter
        return true
      }
      if (isAnyJsxFactoryCall(child, ctx)) {
        return walkJsx(child)
      }
      return false
    }
    if (children.type === "ArrayExpression") {
      for (const el of children.elements ?? []) {
        if (el && visit(el)) return true
      }
    } else {
      return visit(children)
    }
    return false
  }

  function walkJsx(call: AstNode, isRoot = false): boolean {
    if (!isRoot) {
      elementCounter++
    }
    const props = call.arguments?.[1]
    if (props?.type === "ObjectExpression") {
      for (const prop of props.properties ?? []) {
        if (prop.type !== "Property") continue
        if (propKeyName(prop) !== "children") continue
        if (walkChildren(prop.value as AstNode, call)) return true
      }
    }
    return false
  }

  walkJsx(root, true)
  return found
}

const noopTemplateDecl = (): DomTemplateDecl => ({
  varName: "__noop",
  result: {
    html: "",
    holeCount: 0,
    holeNodes: [],
    regions: [],
    bindings: [],
    bindingHosts: [],
    structuralNodeCount: 0,
    structuralWalk: [],
  },
})

export function emitDomSetupFromJsx(
  jsxRoot: AstNode,
  source: string,
  ctx: TemplateSerializeCtx,
  templateDecls: DomTemplateDecl[],
  nextTemplateId: { n: number },
  neededImports: Set<string>,
  install?: DomInstallEmitOptions
): EmitDomSetupResult {
  const result = serializeDomRoot(jsxRoot, ctx)
  if (!result) {
    if (!isCompilableJsxRoot(jsxRoot, ctx)) {
      throw new Error(
        "[vite-plugin-kiru/dom]: could not serialize JSX root to dom template"
      )
    }
    const compiled = compileJsxContent(
      jsxRoot,
      source,
      ctx,
      templateDecls,
      nextTemplateId,
      neededImports,
      install
    )
    return {
      templateDecl: templateDecls[templateDecls.length - 1] ?? noopTemplateDecl(),
      setupLines: compiled.setupLines,
      returnExpr: compiled.returnExpr,
    }
  }

  const tplVar = `$t${nextTemplateId.n++}`
  const elVar = `$el${nextTemplateId.n - 1}`
  const projVar = `$n${nextTemplateId.n - 1}`

  templateDecls.push({ varName: tplVar, result })

  neededImports.add("template")
  neededImports.add("clone")
  neededImports.add("project")

  const lines: string[] = []
  lines.push(`const ${elVar} = clone(${tplVar})`)
  lines.push(`const ${projVar} = project(${tplVar}, ${elVar})`)

  emitDynamicRootProps(
    jsxRoot.arguments?.[1],
    source,
    elVar,
    ctx,
    lines,
    neededImports,
    install
  )

  for (let i = 0; i < result.bindings.length; i++) {
    const binding = result.bindings[i]!
    const host = result.bindingHosts[i]
    if (!host) continue
    emitBehaviorBinding(
      binding,
      host,
      source,
      projVar,
      lines,
      neededImports,
      install
    )
    emitAttrEffectsFromJsxCall(
      host.call,
      host.nodeIndex,
      source,
      projVar,
      lines,
      neededImports,
      install
    )
    emitDynamicClassEffectsFromJsxCall(
      host.call,
      host.nodeIndex,
      source,
      projVar,
      lines,
      neededImports,
      install
    )
    emitDynamicAttrsFromJsxCall(
      host.call,
      host.nodeIndex,
      source,
      projVar,
      lines,
      neededImports,
      install
    )
  }

  for (let i = 0; i < result.holeNodes.length; i++) {
    const node = result.holeNodes[i]!
    const region =
      result.regions[i] ??
      classifyTemplateHoleRegion(node, ctx, i)
    emitHole(
      node,
      region,
      i,
      i,
      source,
      elVar,
      projVar,
      lines,
      ctx,
      templateDecls,
      nextTemplateId,
      neededImports,
      result,
      jsxRoot,
      install
    )
  }

  return {
    templateDecl: templateDecls[templateDecls.length - 1]!,
    setupLines: lines,
    returnExpr: elVar,
  }
}

export function emitMountComponentCallback(
  jsxRoot: AstNode,
  source: string,
  ctx: TemplateSerializeCtx,
  neededImports: Set<string>
): string {
  const result = factoryResultExpr(
    jsxRoot,
    source,
    ctx,
    [],
    { n: 0 },
    neededImports
  )
  return `() => ${result}.getRoot()`
}

export { formatTemplateDecl, escapeTemplateLiteral }
