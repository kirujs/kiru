import * as AST from "./ast.js"
import { blocksModuleHoist, isKiruJsxFactoryCall, isStaticLiteral } from "./scope.js"
import type { TemplateSerializeCtx, TemplateSerializeResult } from "./templateHTML.js"

type AstNode = AST.AstNode

function unwrapExpression(node: AstNode | undefined): AstNode | undefined {
  let current = node
  while (current) {
    if (current.type === "ParenthesizedExpression") {
      current = (current as { expression?: AstNode }).expression
      continue
    }
    if (current.type === "ExpressionStatement") {
      current = (current as { expression?: AstNode }).expression
      continue
    }
    break
  }
  return current
}

function isAnyJsxFactoryCall(
  callNode: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  return (
    isKiruJsxFactoryCall(callNode, ctx.resolve, "jsx") ||
    isKiruJsxFactoryCall(callNode, ctx.resolve, "jsxs") ||
    isKiruJsxFactoryCall(callNode, ctx.resolve, "jsxDEV")
  )
}

function isComponentJsxCall(callNode: AstNode): boolean {
  const typeArg = callNode.arguments?.[0]
  return typeArg?.type === "Identifier" && !!typeArg.name
}

function isStaticComponentCallSite(
  callNode: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  const propsArg = callNode.arguments?.[1]
  if (!propsArg) return true
  if (propsArg.type === "Literal") {
    return propsArg.value === null || propsArg.value === undefined
  }
  if (propsArg.type !== "ObjectExpression") return false
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") return false
    const key =
      prop.key?.type === "Identifier"
        ? prop.key.name
        : prop.key?.type === "Literal" && typeof prop.key.value === "string"
          ? prop.key.value
          : null
    if (!key || key === "ref" || key.startsWith("on") || key.startsWith("bind:")) {
      return false
    }
    const value = prop.value as AstNode
    if (key === "children") {
      if (value?.type === "Identifier" && value.name === "undefined") continue
      if (isStaticLiteral(value)) continue
      return false
    }
    if (!isStaticLiteral(value)) {
      if (value?.type === "Identifier" && value.name) {
        const binding = ctx.resolve(value.name)
        if (binding?.kind === "moduleStatic") continue
      }
      return false
    }
  }
  return true
}

function findModuleBindingInit(
  name: string,
  bodyNodes: readonly AstNode[]
): AstNode | null {
  for (const stmt of bodyNodes) {
    const init = findBindingInitInNode(stmt, name)
    if (init) return init
  }
  return null
}

function findBindingInitInNode(node: AstNode, name: string): AstNode | null {
  if (node.type === "VariableDeclaration") {
    for (const decl of (node as { declarations?: AstNode[] }).declarations ??
      []) {
      if (decl.type !== "VariableDeclarator") continue
      const id = (decl as { id?: AstNode }).id
      if (id?.type === "Identifier" && id.name === name) {
        return (decl as { init?: AstNode }).init ?? null
      }
    }
    return null
  }
  if (node.type === "ExportNamedDeclaration") {
    const decl = (node as { declaration?: AstNode }).declaration
    if (decl) return findBindingInitInNode(decl, name)
    return null
  }
  if (node.type === "ExportDefaultDeclaration") {
    const decl = (node as { declaration?: AstNode }).declaration
    if (
      decl?.type === "FunctionDeclaration" &&
      (decl as { id?: AstNode }).id?.name === name
    ) {
      return decl
    }
    return null
  }
  if (node.type === "FunctionDeclaration") {
    const id = (node as { id?: AstNode }).id
    if (id?.type === "Identifier" && id.name === name) return node
  }
  return null
}

function extractComponentRenderJsx(
  init: AstNode,
  ctx: TemplateSerializeCtx
): AstNode | null {
  if (
    init.type === "ArrowFunctionExpression" ||
    init.type === "FunctionExpression"
  ) {
    const body = (init as { body?: AstNode }).body
    const unwrapped = unwrapExpression(body)
    if (unwrapped?.type === "CallExpression" && isAnyJsxFactoryCall(unwrapped, ctx)) {
      return unwrapped
    }
    if (unwrapped?.type === "BlockStatement") {
      const stmts = (unwrapped as { body?: AstNode[] }).body
      if (stmts?.length === 1 && stmts[0]?.type === "ReturnStatement") {
        const arg = unwrapExpression(
          (stmts[0] as { argument?: AstNode }).argument
        )
        if (arg?.type === "CallExpression" && isAnyJsxFactoryCall(arg, ctx)) {
          return arg
        }
      }
    }
    return null
  }
  if (init.type === "FunctionDeclaration") {
    const body = (init as { body?: AstNode }).body
    if (body?.type === "BlockStatement") {
      for (const stmt of (body as { body?: AstNode[] }).body ?? []) {
        if (stmt.type !== "ReturnStatement") continue
        const arg = unwrapExpression((stmt as { argument?: AstNode }).argument)
        if (arg?.type === "CallExpression" && isAnyJsxFactoryCall(arg, ctx)) {
          return arg
        }
      }
    }
  }
  return null
}

function expressionReferencesBlockedBinding(
  node: AstNode,
  ctx: TemplateSerializeCtx
): boolean {
  let blocked = false
  AST.walk(node, {
    Identifier: (n, walkCtx) => {
      if (!n.name) return
      const parent =
        walkCtx.stack.length > 0
          ? walkCtx.stack[walkCtx.stack.length - 1]!
          : null
      if (
        parent?.type === "Property" &&
        (parent as { key?: AstNode }).key === n
      ) {
        return
      }
      if (n.name === "this" || n.name === "undefined") return
      const binding = ctx.resolve(n.name)
      if (!binding) {
        blocked = true
        return walkCtx.exit()
      }
      if (blocksModuleHoist(binding)) blocked = true
      if (
        binding.kind !== "import" &&
        binding.kind !== "moduleStatic" &&
        binding.kind !== "moduleSignal"
      ) {
        blocked = true
        return walkCtx.exit()
      }
    },
  })
  return blocked
}

export const KIRU_TEMPLATE_REF_PREFIX = "<!--@kiru-tpl-ref:"
export const KIRU_TEMPLATE_REF_SUFFIX = "@-->"

export function templateRefMarker(componentName: string): string {
  return `${KIRU_TEMPLATE_REF_PREFIX}${componentName}${KIRU_TEMPLATE_REF_SUFFIX}`
}

export function parseTemplateRefMarkers(html: string): string[] {
  const names: string[] = []
  const re = /<!--@kiru-tpl-ref:([^@]+)@-->/g
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    names.push(match[1]!)
  }
  return names
}

export function bindingMatchesComponentRender(
  bindingNode: AstNode,
  componentName: string,
  bodyNodes: readonly AstNode[],
  ctx: TemplateSerializeCtx
): boolean {
  const init = findModuleBindingInit(componentName, bodyNodes)
  if (!init) return false
  const renderJsx = extractComponentRenderJsx(init, ctx)
  return renderJsx !== null && bindingNode === renderJsx
}

/** Leaf template HTML for a static module component (zero-hole intrinsic render). */
export function serializeComponentLeafTemplate(
  componentName: string,
  ctx: TemplateSerializeCtx,
  serializeIntrinsic: (jsx: AstNode) => TemplateSerializeResult | null
): TemplateSerializeResult | null {
  if (!ctx.bodyNodes?.length) return null
  const init = findModuleBindingInit(componentName, ctx.bodyNodes)
  if (!init) return null
  const renderJsx = extractComponentRenderJsx(init, ctx)
  if (!renderJsx) return null
  const typeArg = renderJsx.arguments?.[0]
  if (
    !typeArg ||
    typeArg.type !== "Literal" ||
    typeof typeArg.value !== "string"
  ) {
    return null
  }
  if (expressionReferencesBlockedBinding(renderJsx, ctx)) return null
  return serializeIntrinsic(renderJsx)
}

/** Fold `<Badge />` into parent shell via template ref marker (not duplicate HTML). */
export function tryFoldStaticComponentHtml(
  callNode: AstNode,
  ctx: TemplateSerializeCtx,
  serializeIntrinsic: (jsx: AstNode) => TemplateSerializeResult | null
): string | null {
  if (!ctx.bodyNodes?.length) return null
  if (callNode.type !== "CallExpression" || !isComponentJsxCall(callNode)) {
    return null
  }
  if (!isStaticComponentCallSite(callNode, ctx)) return null

  const componentName = (callNode.arguments?.[0] as { name?: string }).name
  if (!componentName) return null
  const binding = ctx.resolve(componentName)
  if (binding?.kind !== "moduleStatic") return null

  const init = findModuleBindingInit(componentName, ctx.bodyNodes)
  if (!init) return null

  const renderJsx = extractComponentRenderJsx(init, ctx)
  if (!renderJsx) return null

  const typeArg = renderJsx.arguments?.[0]
  if (
    !typeArg ||
    typeArg.type !== "Literal" ||
    typeof typeArg.value !== "string"
  ) {
    return null
  }

  if (expressionReferencesBlockedBinding(renderJsx, ctx)) return null

  const inner = serializeIntrinsic(renderJsx)
  if (!inner || inner.holeCount !== 0) return null
  return templateRefMarker(componentName)
}
