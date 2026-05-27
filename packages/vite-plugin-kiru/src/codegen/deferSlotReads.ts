import { parseAst } from "rollup/parseAst"
import * as AST from "./ast.js"
import { deferSlotReadsInJsxCall, type RegionAnalysisCtx } from "./compileRegions.js"
import { isKiruJsxFactoryCall } from "./scope.js"
import { buildProgramBindingResolve, walkProgramBody } from "./scopeWalk.js"
import type { TransformCTX } from "./shared.js"

type AstNode = AST.AstNode

function createRegionCtx(resolve: RegionAnalysisCtx["resolve"]): RegionAnalysisCtx {
  return {
    resolve,
    isJsxProd: (node) =>
      isKiruJsxFactoryCall(node, resolve, "jsx") ||
      isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxs: (node) => isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxDev: (node) => isKiruJsxFactoryCall(node, resolve, "jsxDEV"),
  }
}

/** Wrap signal-reading jsxs slot expressions in `() => …` for deferred subscription. */
export function prepareDeferSlotReads(ctx: TransformCTX): void {
  const source = ctx.code.toString()
  const ast = ctx.ast ?? parseAst(source, { allowReturnOutsideFunction: true })
  const bodyNodes = ast.body as AstNode[]
  const resolve = buildProgramBindingResolve(bodyNodes)
  const analysis = createRegionCtx(resolve)

  const wraps: { start: number; end: number }[] = []

  walkProgramBody(bodyNodes, {
    onCallExpression: (node) => {
      deferSlotReadsInJsxCall(node, analysis, (elem) => {
        wraps.push({ start: elem.start, end: elem.end })
      })
    },
  })

  if (wraps.length === 0) return

  const code = ctx.code
  for (const { start, end } of wraps.sort((a, b) => b.start - a.start)) {
    const expr = source.slice(start, end)
    code.update(start, end, `() => (${expr})`)
  }
}
