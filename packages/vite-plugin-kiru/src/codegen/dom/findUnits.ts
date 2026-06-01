import * as AST from "../ast.js"
import { isImportedCall, isKiruJsxFactoryCall } from "../scope.js"
import type { TemplateSerializeCtx } from "../templateHTML.js"
import { isComponentJsxCall } from "./emitSetup.js"

type AstNode = AST.AstNode

export type DomCompileUnit =
  | {
      kind: "render"
      setupFn: AstNode
      preserveStart: number
      preserveEnd: number
      replaceStart: number
      replaceEnd: number
      jsxRoot: AstNode
      wrapInRenderArrow: boolean
      /** Param count on the render arrow wrapping JSX (`0` => `() => jsx`, `1` => `(props) => jsx`). */
      renderArrowParamCount: number
      /** Outer factory param count (`0` for `() => (props) => jsx`). */
      setupFnParamCount: number
      /** Shape C: install template setup in outer `()` before `return (props) => $root`. */
      installInOuterSetup: boolean
      /** Shape B: one-time install in `(props) =>` before `return () => $root`. */
      installInPropsArrowOnce: boolean
      /** `(props) => { … return jsx }` — install before inner return inside props arrow. */
      installInPropsBlock: boolean
    }
  | {
      kind: "mount_component"
      jsxRoot: AstNode
      replaceStart: number
      replaceEnd: number
    }
  | {
      kind: "mount_intrinsic_expr"
      jsxRoot: AstNode
      replaceStart: number
      replaceEnd: number
    }

function isJsxRoot(node: AstNode | undefined, ctx: TemplateSerializeCtx): node is AstNode {
  if (!node) return false
  return (
    isKiruJsxFactoryCall(node, ctx.resolve, "jsx") ||
    isKiruJsxFactoryCall(node, ctx.resolve, "jsxs") ||
    isKiruJsxFactoryCall(node, ctx.resolve, "jsxDEV")
  )
}

function isMountCall(node: AstNode, ctx: TemplateSerializeCtx): boolean {
  return isImportedCall(node, ctx.resolve, { imported: "mount", source: "kiru/dom" })
}

function unwrapRenderExpr(node: AstNode | undefined): AstNode | null {
  let current = node
  while (current) {
    if (current.type === "ParenthesizedExpression") {
      current = (current as { expression?: AstNode }).expression
      continue
    }
    break
  }
  return current ?? null
}

function jsxFromRenderArrow(arrow: AstNode): AstNode | null {
  const body = (arrow as { body?: AstNode }).body
  if (!body) return null
  if (body.type !== "BlockStatement") {
    return unwrapRenderExpr(body)
  }
  const stmts = (body as { body?: AstNode[] }).body ?? []
  for (let i = stmts.length - 1; i >= 0; i--) {
    const stmt = stmts[i]!
    if (stmt.type === "ReturnStatement") {
      return unwrapRenderExpr((stmt as { argument?: AstNode }).argument)
    }
  }
  return null
}

function findRenderReturnInBlock(
  block: AstNode,
  ctx: TemplateSerializeCtx
): {
  returnStmt: AstNode
  jsxRoot: AstNode
  wrapInRenderArrow: boolean
  renderArrowParamCount: number
  renderHostArrow?: AstNode
} | null {
  const stmts = (block as { body?: AstNode[] }).body ?? []
  for (let i = stmts.length - 1; i >= 0; i--) {
    const stmt = stmts[i]!
    if (stmt.type !== "ReturnStatement") continue
    const arg = unwrapRenderExpr((stmt as { argument?: AstNode }).argument)
    if (!arg) continue
    if (isJsxRoot(arg, ctx)) {
      return {
        returnStmt: stmt,
        jsxRoot: arg,
        wrapInRenderArrow: false,
        renderArrowParamCount: 0,
      }
    }
    if (arg.type === "ArrowFunctionExpression") {
      const params = (arg as { params?: AstNode[] }).params ?? []
      const arrowBody = (arg as { body?: AstNode }).body
      if (arrowBody && arrowBody.type !== "BlockStatement") {
        const jsxRoot = unwrapRenderExpr(arrowBody)
        if (jsxRoot && isJsxRoot(jsxRoot, ctx)) {
          return {
            returnStmt: stmt,
            jsxRoot,
            wrapInRenderArrow: true,
            renderArrowParamCount: params.length,
          }
        }
      } else if (arrowBody?.type === "BlockStatement") {
        const inner = findRenderReturnInBlock(arrowBody, ctx)
        if (inner && isJsxRoot(inner.jsxRoot, ctx)) {
          return {
            returnStmt: inner.returnStmt,
            jsxRoot: inner.jsxRoot,
            wrapInRenderArrow: false,
            renderArrowParamCount: 0,
            renderHostArrow: arg,
          }
        }
      }
    }
  }
  return null
}

function blockBody(fn: AstNode): AstNode | null {
  const body = (fn as { body?: AstNode }).body
  if (!body) return null
  if (body.type === "BlockStatement") return body
  return null
}

function isMountCallbackArrow(fn: AstNode, walkCtx: AST.WalkContext, ctx: TemplateSerializeCtx): boolean {
  const parent = walkCtx.parent()
  if (!parent || parent.type !== "CallExpression") return false
  const args = (parent as { arguments?: AstNode[] }).arguments
  if (!args || args[0] !== fn) return false
  return isMountCall(parent, ctx)
}

export function findDomCompileUnits(
  bodyNodes: AstNode[],
  ctx: TemplateSerializeCtx
): DomCompileUnit[] {
  const units: DomCompileUnit[] = []
  const seen = new Set<AstNode>()

  const visitor = {
    FunctionDeclaration: (node: AstNode, walkCtx: AST.WalkContext) =>
      considerFn(node, walkCtx, ctx, units, seen),
    FunctionExpression: (node: AstNode, walkCtx: AST.WalkContext) =>
      considerFn(node, walkCtx, ctx, units, seen),
    ArrowFunctionExpression: (node: AstNode, walkCtx: AST.WalkContext) => {
      considerFn(node, walkCtx, ctx, units, seen)
      considerMountExprBody(node, walkCtx, ctx, units, seen)
    },
  }

  for (const node of bodyNodes) {
    AST.walk(node, visitor)
  }

  return units.sort((a, b) => (a.replaceStart as number) - (b.replaceStart as number))
}

function considerFn(
  fn: AstNode,
  walkCtx: AST.WalkContext,
  ctx: TemplateSerializeCtx,
  units: DomCompileUnit[],
  seen: Set<AstNode>
): void {
  if (seen.has(fn)) return
  const block = blockBody(fn)
  if (!block) return
  const hit = findRenderReturnInBlock(block, ctx)
  if (!hit) return
  seen.add(fn)

  const renderHostArrow = (hit as { renderHostArrow?: AstNode }).renderHostArrow
  const hostFn = renderHostArrow ?? fn
  if (renderHostArrow) seen.add(renderHostArrow)

  const hostBlock = blockBody(hostFn)
  const stmts = (hostBlock as { body?: AstNode[] } | null)?.body ?? []
  const returnIdx = stmts.indexOf(hit.returnStmt)
  const preserveStart = (hostBlock as { start?: number } | null)?.start as number
  const preserveEnd =
    returnIdx > 0 ? (stmts[returnIdx - 1]!.end as number) : preserveStart

  const setupFnParamCount =
    ((fn as { params?: AstNode[] }).params ?? []).length
  const wrapInRenderArrow =
    hit.wrapInRenderArrow && !isMountCallbackArrow(fn, walkCtx, ctx)
  const installInPropsBlock = renderHostArrow !== undefined

  units.push({
    kind: "render",
    setupFn: fn,
    preserveStart,
    preserveEnd,
    replaceStart: hit.returnStmt.start as number,
    replaceEnd: hit.returnStmt.end as number,
    jsxRoot: hit.jsxRoot,
    wrapInRenderArrow,
    renderArrowParamCount: hit.renderArrowParamCount,
    setupFnParamCount,
    installInOuterSetup:
      !installInPropsBlock &&
      wrapInRenderArrow &&
      hit.renderArrowParamCount === 1 &&
      setupFnParamCount === 0,
    installInPropsArrowOnce:
      !installInPropsBlock &&
      wrapInRenderArrow &&
      hit.renderArrowParamCount === 0 &&
      setupFnParamCount === 1,
    installInPropsBlock,
  })
}

function considerMountExprBody(
  arrow: AstNode,
  walkCtx: AST.WalkContext,
  ctx: TemplateSerializeCtx,
  units: DomCompileUnit[],
  seen: Set<AstNode>
): void {
  if (!isMountCallbackArrow(arrow, walkCtx, ctx)) return
  const body = (arrow as { body?: AstNode }).body
  if (!body || body.type === "BlockStatement") return
  const jsxRoot = unwrapRenderExpr(body)
  if (!jsxRoot || !isJsxRoot(jsxRoot, ctx)) return
  if (seen.has(arrow)) return
  seen.add(arrow)

  if (isComponentJsxCall(jsxRoot, ctx)) {
    units.push({
      kind: "mount_component",
      jsxRoot,
      replaceStart: arrow.start as number,
      replaceEnd: arrow.end as number,
    })
    return
  }

  units.push({
    kind: "mount_intrinsic_expr",
    jsxRoot,
    replaceStart: body.start as number,
    replaceEnd: body.end as number,
  })
}
