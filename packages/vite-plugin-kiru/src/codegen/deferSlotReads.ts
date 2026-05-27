import type { ProgramNode } from "rollup"
import * as AST from "./ast.js"
import {
  deferPlanToEdits,
  type DeferPlan,
  wrapDeferredExpr,
} from "./codegenPlan.js"
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

export function analyzeDeferSlotReads(
  ast: ProgramNode,
  source: string,
  resolve: RegionAnalysisCtx["resolve"]
): DeferPlan {
  const bodyNodes = ast.body as AstNode[]
  const analysis = createRegionCtx(resolve)
  const wraps: DeferPlan["wraps"] = []

  walkProgramBody(bodyNodes, {
    onCallExpression: (node) => {
      deferSlotReadsInJsxCall(node, analysis, (elem) => {
        wraps.push({
          node: elem,
          text: wrapDeferredExpr(source, elem),
        })
      })
    },
  })

  return { wraps }
}

/** @deprecated Use analyzeDeferSlotReads + applyCodegenPlan via jsxHoistPipeline */
export function prepareDeferSlotReads(ctx: TransformCTX): void {
  const source = ctx.code.toString()
  const resolve = buildProgramBindingResolve(ctx.ast.body as AstNode[])
  const plan = analyzeDeferSlotReads(ctx.ast, source, resolve)
  for (const edit of deferPlanToEdits(plan)) {
    if (edit.kind === "replace") {
      ctx.code.update(edit.start, edit.end, edit.text)
    }
  }
}

export { deferPlanToEdits }
