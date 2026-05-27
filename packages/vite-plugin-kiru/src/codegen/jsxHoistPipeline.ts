import type { TransformCTX } from "./shared.js"
import {
  applyCodegenPlan,
  deferWrapMap,
  emptyCodegenPlan,
  mergeCodegenPlans,
} from "./codegenPlan.js"
import { analyzeDeferSlotReads, deferPlanToEdits } from "./deferSlotReads.js"
import {
  analyzeJsxHoisting,
  buildHoistVarByNode,
  hoistPlanToEdits,
} from "./hoistJSX.js"
import {
  analyzeTemplateBindings,
  templateAbsorbedNodes,
  templateHoleNodes,
  templatePlanToEdits,
} from "./prepareJSXTemplates.js"
import { buildProgramCallIndex, programResolve } from "./programCallIndex.js"
import type * as AST from "./ast.js"

type AstNode = AST.AstNode

/** Template shells (with holes) first, then hoist remaining static JSX. */
export function applyJsxHoistAndTemplates(ctx: TransformCTX): void {
  const source = ctx.code.toString()
  const bodyNodes = ctx.ast.body as AstNode[]
  const callIndex = buildProgramCallIndex(bodyNodes)
  const resolve = programResolve(callIndex)

  const templatePlan = analyzeTemplateBindings(ctx.ast, resolve, callIndex)
  const templateAbsorbed = templateAbsorbedNodes(templatePlan)

  const deferPlanFull = analyzeDeferSlotReads(ctx.ast, source, resolve, callIndex)
  const deferPlan = filterDeferOutsideTemplates(deferPlanFull, templateAbsorbed)
  const deferByNode = deferWrapMap(deferPlan)
  const hoistPlan = analyzeJsxHoisting(ctx.ast, source, {
    templateAbsorbed,
    templateHoleNodes: templateHoleNodes(templatePlan),
    templatePlan,
    deferByNode,
    callIndex,
  })
  const hoistByNode = hoistPlan ? buildHoistVarByNode(hoistPlan) : new Map()
  const renderRootVarByBindingNode = new Map<AstNode, string>()
  const renderRootBindingSkipTemplateReplace = new Set<AstNode>()
  if (hoistPlan) {
    for (const cache of hoistPlan.renderRootCacheDecls) {
      if (cache.tier === "module") {
        renderRootVarByBindingNode.set(cache.exprNode, cache.varName)
      } else {
        renderRootBindingSkipTemplateReplace.add(cache.exprNode)
      }
    }
  }

  const templateCodegen = templatePlan
    ? templatePlanToEdits(
        templatePlan,
        source,
        deferByNode,
        hoistByNode,
        renderRootVarByBindingNode,
        renderRootBindingSkipTemplateReplace
      )
    : emptyCodegenPlan()

  const hoistCodegen = hoistPlan
    ? hoistPlanToEdits(hoistPlan, source, templateAbsorbed)
    : emptyCodegenPlan()

  const deferCodegen = {
    edits: deferPlanToEdits(deferPlan),
    imports: emptyCodegenPlan().imports,
  }

  const plan = mergeCodegenPlans(deferCodegen, templateCodegen, hoistCodegen)
  applyCodegenPlan(ctx.code, plan)
  ctx.didTransform = ctx.code.toString() !== source
}

export function jsxTransformChanged(ctx: TransformCTX): boolean {
  return ctx.didTransform === true
}

function nodeContains(outer: AstNode, inner: AstNode): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

function filterDeferOutsideTemplates(
  plan: import("./codegenPlan.js").DeferPlan,
  templateAbsorbed: Set<AstNode>
): import("./codegenPlan.js").DeferPlan {
  if (templateAbsorbed.size === 0) return plan
  return {
    wraps: plan.wraps.filter((w) => {
      for (const root of templateAbsorbed) {
        if (w.node === root || nodeContains(root, w.node)) return false
      }
      return true
    }),
  }
}
