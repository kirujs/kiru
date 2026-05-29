import type { ProgramNode } from "rollup"
import * as AST from "./ast.js"
import {
  applyCodegenPlan,
  emptyCodegenPlan,
  sliceNode,
  type CodegenImportFlags,
  type CodegenPlan,
  type SourceEdit,
} from "./codegenPlan.js"
import {
  classifyChildSlotRegion,
  formatBindingPayloadsLiteral,
  formatRegionsLiteral,
  formatTemplateBindingsLiteral,
  getCompileRegionsForJsxs,
} from "./compileRegions.js"
import { formatBindingPayloadSlots } from "./prepareJSXTemplates.js"
import type { TemplateBindingHost } from "./templateHTML.js"
import { TransformCTX } from "./shared.js"
import {
  buildProgramCallIndex,
  findSetupRenderInsertBefore,
  type ProgramCallIndex,
} from "./programCallIndex.js"
import { buildProgramBindingResolve, walkProgramBody } from "./scopeWalk.js"
import {
  blocksModuleHoist,
  blocksSetupHoist,
  isKiruJsxFactoryCall,
  isModuleSignalBinding,
  isSignalFactoryCall,
  isStaticLiteral,
  type BindingInfo,
} from "./scope.js"

type AstNode = AST.AstNode

type Hoistable = {
  node: AstNode
  code: string
  varName: string
}

type AnalysisCtx = {
  resolve: (name: string) => BindingInfo | null
  isJsxProd: (node: AstNode) => boolean
  isJsxs: (node: AstNode) => boolean
  isJsxDev: (node: AstNode) => boolean
}

type HoistTier = "module" | "setup"

type BindingBlocksFn = (binding: BindingInfo | null) => boolean

type SetupHoistCandidate = {
  rootJsx: AstNode
  /** Setup `return () =>` statement — insert `const $kN` immediately before. */
  insertBefore: AstNode
}

type SetupHolePayloadCandidate = {
  exprNode: AstNode
  jsxNode: AstNode
  /** Setup `return () =>` statement — insert `const $kN` immediately before. */
  insertBefore: AstNode
  /** Lexical resolver for the candidate's call site. */
  resolve: (name: string) => BindingInfo | null
  /** Lazy conditional hole (`toggled() && jsx(...)`) — not intrinsic-only jsx payload. */
  isConditional?: boolean
}

function createAnalysisCtx(
  resolve: (name: string) => BindingInfo | null
): AnalysisCtx {
  return {
    resolve,
    isJsxProd: (node) =>
      isKiruJsxFactoryCall(node, resolve, "jsx") ||
      isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxs: (node) => isKiruJsxFactoryCall(node, resolve, "jsxs"),
    isJsxDev: (node) => isKiruJsxFactoryCall(node, resolve, "jsxDEV"),
  }
}

const NON_TRACKING_SIGNAL_METHODS = new Set(["peek", "set", "sneak"])

/** Matches `FLAG_HOISTED` in packages/lib/src/constants.ts (1 << 5). */
const FLAG_HOISTED_BIT = 32

export type TemplateHoistPlanSlice = {
  bindings: {
    node: AstNode
    holeNodes: AstNode[]
    varName: string
    regions: import("kiru/template").CompileRegion[]
    bindings: import("kiru/template").TemplateBindingDescriptor[]
    bindingHosts: TemplateBindingHost[]
  }[]
}

export type AnalyzeJsxHoistingOpts = {
  templateAbsorbed: Set<AstNode>
  templateHoleNodes: Set<AstNode>
  templatePlan: TemplateHoistPlanSlice | null
  deferByNode: Map<AstNode, string>
  callIndex?: ProgramCallIndex
}

function mayHoistInsideTemplateShell(
  node: AstNode,
  templateAbsorbed: Set<AstNode>,
  templateHoleNodes: Set<AstNode>
): boolean {
  if (!isInsideTemplateBindingRoot(node, templateAbsorbed)) return true
  if (node.type === "ArrayExpression") return true
  return templateHoleNodes.has(node)
}

type RenderRootCacheTier = "module" | "componentBody" | "setupReturn"

export type RenderRootCacheDecl = {
  exprNode: AstNode
  tier: RenderRootCacheTier
  /** `ReturnStatement` to insert before (setup/component); null for module tier. */
  insertBefore: AstNode | null
  varName: string
  codeExpr: string
  /** Hole AST nodes folded inline into `$rN` (suppress setup hole hoists). */
  foldedHoleNodes: Set<AstNode>
  /** Module `$kN` jsx roots inlined into `$rN` instead of separate hoists. */
  inlinedJsxNodes: Set<AstNode>
}

export type HoistPlan = {
  allHoistables: Hoistable[]
  setupHoistDecls: {
    insertBefore: AstNode
    replaceNode: AstNode
    varName: string
    codeExpr: string
  }[]
  renderRootCacheDecls: RenderRootCacheDecl[]
  dynamicSlotWraps: {
    node: AstNode
    regions: import("kiru/template").CompileRegion[]
  }[]
  hoistedNodes: Set<AstNode>
  setupRootNodes: Set<AstNode>
  regionElementLines: string[]
  declarations: string | null
  moduleInsertPos: number
  imports: CodegenImportFlags
  bodyNodes: AstNode[]
}

function isTemplateBindingRoot(
  node: AstNode,
  templateAbsorbed: Set<AstNode>
): boolean {
  return templateAbsorbed.has(node)
}

function isInsideTemplateBindingRoot(
  node: AstNode,
  templateAbsorbed: Set<AstNode>
): boolean {
  for (const root of templateAbsorbed) {
    if (node !== root && nodeContains(root, node)) return true
  }
  return false
}

export function buildHoistVarByNode(plan: HoistPlan): Map<AstNode, string> {
  const byNode = new Map<AstNode, string>()
  for (const h of plan.allHoistables) byNode.set(h.node, h.varName)
  for (const s of plan.setupHoistDecls) byNode.set(s.replaceNode, s.varName)
  return byNode
}

export function analyzeJsxHoisting(
  ast: ProgramNode,
  source: string,
  opts: AnalyzeJsxHoistingOpts
): HoistPlan | null {
  const bodyNodes = ast.body as AstNode[]
  const {
    templateAbsorbed,
    templateHoleNodes,
    templatePlan,
    deferByNode,
    callIndex: sharedCallIndex,
  } = opts
  const moduleComponentNames = collectModuleComponentNames(bodyNodes)

  const hoistableCalls: AstNode[] = []
  const hoistableRegionArrays: AstNode[] = []
  const dynamicSlotCalls: {
    node: AstNode
    regions: import("kiru/template").CompileRegion[]
  }[] = []
  const setupHoistCandidates: SetupHoistCandidate[] = []
  const setupHolePayloadCandidates: SetupHolePayloadCandidate[] = []

  const callIndex =
    sharedCallIndex ??
    buildProgramCallIndex(bodyNodes, {
      onCallExpression: () => {},
      onArrayExpression: () => {},
    })
  collectHoistCandidatesFromIndex(callIndex, {
    templateAbsorbed,
    templateHoleNodes,
    hoistableCalls,
    hoistableRegionArrays,
    dynamicSlotCalls,
    setupHoistCandidates,
    setupHolePayloadCandidates,
  })

  const resolve = (name: string) => callIndex.scope.resolve(name)
  const analysis = createAnalysisCtx(resolve)

  if (templatePlan) {
    for (const binding of templatePlan.bindings) {
      const bindingSite = callIndex.getCall(binding.node.start)
      const insertBefore = bindingSite?.setupInsertBefore ?? null
      for (const hole of binding.holeNodes) {
        const hoistTargets = expandTemplateHoleHoistTargets(hole, analysis)
        for (const target of hoistTargets) {
          if (isTemplateBindingRoot(target, templateAbsorbed)) continue

          const conditionalExpr = extractConditionalTemplateHole(
            target,
            analysis
          )
          if (conditionalExpr) {
            let decided = false
            for (const site of callIndex.callsContainedIn(conditionalExpr)) {
              if (decided) break
              const scopedAnalysis = createAnalysisCtx(site.resolve)
              if (
                canHoistConditionalHoleExpr(
                  conditionalExpr,
                  scopedAnalysis,
                  "module"
                )
              ) {
                hoistableCalls.push(conditionalExpr)
                decided = true
                break
              }
              if (
                insertBefore &&
                canHoistConditionalHoleExpr(
                  conditionalExpr,
                  scopedAnalysis,
                  "setup"
                )
              ) {
                setupHolePayloadCandidates.push({
                  exprNode: conditionalExpr,
                  jsxNode: conditionalExpr,
                  insertBefore,
                  resolve: site.resolve,
                  isConditional: true,
                })
                decided = true
              }
            }
            continue
          }

          const targetSite = callIndex.getCall(target.start)
          if (!targetSite) continue
          const scopedAnalysis = createAnalysisCtx(targetSite.resolve)
          const payload = extractSetupHoistableHolePayload(
            target,
            scopedAnalysis
          )
          if (insertBefore && payload) {
            const setupCand: SetupHolePayloadCandidate = {
              exprNode: payload.exprNode,
              jsxNode: payload.jsxNode,
              insertBefore,
              resolve: targetSite.resolve,
            }
            if (canHoistHolePayloadToSetup(setupCand)) {
              setupHolePayloadCandidates.push(setupCand)
              continue
            }
          }
          if (
            templateHoleNodes.has(target) &&
            !isElementOfRegionArrayHole(target, binding.holeNodes)
          ) {
            if (
              canHoistComponentCallToModule(
                target,
                createAnalysisCtx(targetSite.resolve),
                moduleComponentNames
              )
            ) {
              hoistableCalls.push(target)
            }
            continue
          }
          if (canHoistToModule(target, scopedAnalysis)) {
            hoistableCalls.push(target)
          }
        }
      }
    }
  }

  const setupHoists = dedupeSetupHoistCandidates(setupHoistCandidates).filter(
    (c) => canHoistToSetup(c.rootJsx, analysis)
  )
  const setupHoleHoists = dedupeSetupHolePayloadCandidates(
    setupHolePayloadCandidates
  ).filter((c) => canHoistHolePayloadToSetup(c))
  const setupRootNodes = new Set(setupHoists.map((c) => c.rootJsx))
  const setupHoleExprNodes = new Set(setupHoleHoists.map((c) => c.exprNode))
  let counter = 0
  const allHoistables: Hoistable[] = []
  const hoistedNodes = new Set<AstNode>()
  const regionArraysToHoist = new Set(hoistableRegionArrays)

  const seenHoistCalls = new Set<number>()
  const dedupedHoistableCalls: AstNode[] = []
  for (const call of hoistableCalls) {
    if (seenHoistCalls.has(call.start)) continue
    seenHoistCalls.add(call.start)
    dedupedHoistableCalls.push(call)
  }

  const callsForHoist = dedupedHoistableCalls.filter(
    (call) =>
      !isDirectChildOfAnyArray(call, regionArraysToHoist) &&
      !setupRootNodes.has(call) &&
      !setupHoleExprNodes.has(call) &&
      !isStrictlyInsideAnyNode(call, setupRootNodes) &&
      !callIndex.moduleHoistInits.has(call.start) &&
      mayHoistInsideTemplateShell(call, templateAbsorbed, templateHoleNodes)
  )

  const maximalHoists = filterMaximalHoistCandidates(callsForHoist)
  const sortedRegionArrays = [...regionArraysToHoist].sort(
    (a, b) => a.start - b.start
  )
  const sortedHoists = [...maximalHoists].sort((a, b) => a.start - b.start)

  const sortedAllNodes = [...sortedRegionArrays, ...sortedHoists].sort(
    (a, b) => a.start - b.start
  )

  let needsTagStaticChildrenList = false
  let needsRegionElement = dynamicSlotCalls.length > 0
  let needsMarkHoisted = false
  for (const node of sortedAllNodes) {
    const varName = `$k${counter++}`
    if (node.type === "ArrayExpression") {
      const arrayCode = sliceNode(source, node, deferByNode)
      const fullyStatic = isFullyStaticRegionArray(node, analysis)
      if (fullyStatic) needsTagStaticChildrenList = true
      const codeExpr = fullyStatic
        ? `tagStaticChildrenList(${arrayCode})`
        : arrayCode
      allHoistables.push({ node, code: codeExpr, varName })
    } else if (isConditionalHoleShape(node)) {
      allHoistables.push({
        node,
        code: lazyConditionalHoleCodeExpr(source, node, deferByNode),
        varName,
      })
    } else {
      let codeExpr = sliceNode(source, node, deferByNode)
      if (node.type === "CallExpression" && isJsxFactoryCall(node, analysis)) {
        const wrapped = buildRegionElementWrap(node, analysis, codeExpr)
        if (wrapped) {
          codeExpr = wrapped
          if (wrapped.startsWith("markHoisted(")) needsMarkHoisted = true
          else needsRegionElement = true
        }
      }
      allHoistables.push({
        node,
        code: codeExpr,
        varName,
      })
    }
  }

  const regionElementLines = buildRegionElementLines(allHoistables, analysis)
  for (const line of regionElementLines) {
    if (line.includes("markHoisted(")) needsMarkHoisted = true
    else needsRegionElement = true
  }

  const regionsByJsxNode = new Map<
    AstNode,
    import("kiru/template").CompileRegion[]
  >()
  for (const { node, regions } of dynamicSlotCalls) {
    regionsByJsxNode.set(node, regions)
  }

  const setupHoistDecls: {
    insertBefore: AstNode
    replaceNode: AstNode
    varName: string
    codeExpr: string
  }[] = []
  for (const candidate of setupHoists) {
    const varName = `$k${counter++}`
    let codeExpr = sliceNode(source, candidate.rootJsx, deferByNode)
    const wrapped = buildRegionElementWrap(
      candidate.rootJsx,
      analysis,
      codeExpr,
      "setup"
    )
    if (wrapped) {
      codeExpr = wrapped
      if (wrapped.startsWith("markHoisted(")) needsMarkHoisted = true
      else needsRegionElement = true
    } else {
      const regions =
        regionsByJsxNode.get(candidate.rootJsx) ??
        getCompileRegionsForJsxs(candidate.rootJsx, analysis)
      if (regions && regions.length > 0) {
        codeExpr = `regionElement(${codeExpr}, ${formatRegionsLiteral(
          regions
        )})`
        needsRegionElement = true
      }
    }
    setupHoistDecls.push({
      insertBefore: candidate.insertBefore,
      replaceNode: candidate.rootJsx,
      varName,
      codeExpr,
    })
    hoistedNodes.add(candidate.rootJsx)
  }
  const hoistByNode = new Map<AstNode, string>()
  for (const h of allHoistables) {
    hoistByNode.set(h.node, h.varName)
  }

  let rCounter = 0
  const renderRootCacheDecls = collectRenderRootCacheDecls(
    callIndex,
    source,
    deferByNode,
    hoistByNode,
    moduleComponentNames,
    templatePlan,
    () => `$r${rCounter++}`
  )

  const foldedHoleExprNodes = new Set<AstNode>()
  const inlinedJsxFromRenderCache = new Set<AstNode>()
  for (const cache of renderRootCacheDecls) {
    for (const n of cache.foldedHoleNodes) foldedHoleExprNodes.add(n)
    for (const n of cache.inlinedJsxNodes) inlinedJsxFromRenderCache.add(n)
    hoistedNodes.add(cache.exprNode)
  }

  const filteredHoistables = allHoistables.filter(
    (h) => !inlinedJsxFromRenderCache.has(h.node)
  )
  if (filteredHoistables.length !== allHoistables.length) {
    allHoistables.length = 0
    allHoistables.push(...filteredHoistables)
    hoistByNode.clear()
    for (const h of allHoistables) hoistByNode.set(h.node, h.varName)
  }

  const declarationsAfterFilter =
    allHoistables.length === 0
      ? null
      : allHoistables.length === 1
      ? `const ${allHoistables[0].varName} = ${allHoistables[0].code}`
      : allHoistables
          .map((h, i) =>
            i === 0
              ? `const ${h.varName} = ${h.code}`
              : `  ${h.varName} = ${h.code}`
          )
          .join(",\n")

  for (const candidate of setupHoleHoists) {
    if (foldedHoleExprNodes.has(candidate.exprNode)) continue
    const varName = `$k${counter++}`
    const codeExpr = candidate.isConditional
      ? lazyConditionalHoleCodeExpr(source, candidate.exprNode, deferByNode)
      : sliceNode(source, candidate.exprNode, deferByNode)
    setupHoistDecls.push({
      insertBefore: candidate.insertBefore,
      replaceNode: candidate.exprNode,
      varName,
      codeExpr,
    })
    hoistedNodes.add(candidate.exprNode)
    hoistedNodes.add(candidate.jsxNode)
  }

  for (const h of allHoistables) {
    hoistedNodes.add(h.node)
  }

  const imports: CodegenImportFlags = {
    needTagStaticChildrenList: needsTagStaticChildrenList,
    needRegionElement: needsRegionElement,
    needMarkHoisted: needsMarkHoisted,
  }

  const moduleRenderCaches = renderRootCacheDecls.filter(
    (c) => c.tier === "module"
  )

  let moduleInsertPos = 0
  if (allHoistables.length > 0 || moduleRenderCaches.length > 0) {
    const moduleDeps = collectReferencedModuleBindings(allHoistables, resolve)
    moduleInsertPos = findModuleHoistInsertPosition(
      bodyNodes,
      source,
      moduleDeps
    )
  }

  if (
    allHoistables.length === 0 &&
    hoistableRegionArrays.length === 0 &&
    dynamicSlotCalls.length === 0 &&
    setupHoistDecls.length === 0 &&
    renderRootCacheDecls.length === 0
  ) {
    return null
  }

  const dynamicSlotWraps: HoistPlan["dynamicSlotWraps"] = []
  for (const { node, regions } of dynamicSlotCalls) {
    if (hoistedNodes.has(node)) continue
    if (isStrictlyInsideAnyNode(node, setupRootNodes)) continue
    if (
      isTemplateBindingRoot(node, templateAbsorbed) ||
      isInsideTemplateBindingRoot(node, templateAbsorbed)
    ) {
      continue
    }
    dynamicSlotWraps.push({ node, regions })
    imports.needRegionElement = true
  }

  return {
    allHoistables,
    setupHoistDecls,
    renderRootCacheDecls,
    dynamicSlotWraps,
    hoistedNodes,
    setupRootNodes,
    regionElementLines,
    declarations: declarationsAfterFilter,
    moduleInsertPos,
    imports,
    bodyNodes,
  }
}

function collectHoistCandidatesFromIndex(
  callIndex: ProgramCallIndex,
  opts: {
    templateAbsorbed: Set<AstNode>
    templateHoleNodes: Set<AstNode>
    hoistableCalls: AstNode[]
    hoistableRegionArrays: AstNode[]
    dynamicSlotCalls: {
      node: AstNode
      regions: import("kiru/template").CompileRegion[]
    }[]
    setupHoistCandidates: SetupHoistCandidate[]
    setupHolePayloadCandidates: SetupHolePayloadCandidate[]
  }
): void {
  const {
    templateAbsorbed,
    templateHoleNodes,
    hoistableCalls,
    hoistableRegionArrays,
    dynamicSlotCalls,
    setupHoistCandidates,
    setupHolePayloadCandidates,
  } = opts

  callIndex.forEachCall((site) => {
    const node = site.node
    const analysis = createAnalysisCtx(site.resolve)
    if (
      site.setupInsertBefore &&
      isJsxFactoryCall(node, analysis) &&
      !isTemplateBindingRoot(node, templateAbsorbed)
    ) {
      setupHoistCandidates.push({
        rootJsx: node,
        insertBefore: site.setupInsertBefore,
      })
    }
    if (isCreateHoledTemplateCall(node) && site.setupInsertBefore) {
      setupHolePayloadCandidates.push(
        ...findSetupHolePayloadCandidates(
          node,
          analysis,
          site.setupInsertBefore
        )
      )
    }
    if (
      canHoistToModule(node, analysis) &&
      !isTemplateBindingRoot(node, templateAbsorbed)
    ) {
      hoistableCalls.push(node)
    }
    const regions = getCompileRegionsForJsxs(node, analysis)
    if (regions) {
      dynamicSlotCalls.push({ node, regions })
    }
  })

  callIndex.forEachArray((site) => {
    const node = site.node
    const analysis = createAnalysisCtx(site.resolve)
    if (
      isCreateHoledTemplateRegionHole(node, site.parent, site.grandparent) &&
      canHoistRegionArray(node, analysis) &&
      mayHoistInsideTemplateShell(node, templateAbsorbed, templateHoleNodes)
    ) {
      hoistableRegionArrays.push(node)
    }
  })
}

export function hoistPlanToEdits(
  plan: HoistPlan,
  source: string,
  templateAbsorbed: Set<AstNode>
): CodegenPlan {
  const edits: SourceEdit[] = []
  const renderRootCacheExprs = new Set(
    plan.renderRootCacheDecls.map((c) => c.exprNode)
  )
  const isInsideRenderRootCache = (node: AstNode): boolean => {
    for (const root of renderRootCacheExprs) {
      if (node !== root && nodeContains(root, node)) return true
    }
    return false
  }

  for (const h of plan.allHoistables) {
    if (isInsideTemplateBindingRoot(h.node, templateAbsorbed)) continue
    if (isInsideRenderRootCache(h.node)) continue
    edits.push({
      kind: "replace",
      start: h.node.start,
      end: h.node.end,
      text: h.varName,
    })
  }

  for (const {
    insertBefore,
    replaceNode,
    varName,
    codeExpr,
  } of plan.setupHoistDecls) {
    edits.push({
      kind: "appendLeft",
      pos: insertBefore.start,
      text: `const ${varName} = ${codeExpr};\n`,
    })
    if (isInsideTemplateBindingRoot(replaceNode, templateAbsorbed)) continue
    if (isInsideRenderRootCache(replaceNode)) continue
    edits.push({
      kind: "replace",
      start: replaceNode.start,
      end: replaceNode.end,
      text: varName,
    })
  }

  for (const cache of plan.renderRootCacheDecls) {
    if (cache.tier === "module") {
      // Module-tier render-root expression replacement is owned by template pass.
      continue
    }
    if (cache.insertBefore?.type === "ReturnStatement") {
      const ret = cache.insertBefore
      const renderFn = (ret as { argument?: AstNode }).argument
      const isSetupReturn =
        renderFn?.type === "ArrowFunctionExpression" &&
        ((renderFn as { params?: AstNode[] }).params ?? []).length === 0
      edits.push({
        kind: "replace",
        start: ret.start,
        end: ret.end,
        text: isSetupReturn
          ? `const ${cache.varName} = ${cache.codeExpr};\nreturn () => ${cache.varName}`
          : `const ${cache.varName} = ${cache.codeExpr};\nreturn ${cache.varName}`,
      })
      continue
    }
    if (!isCreateHoledTemplateCall(cache.exprNode)) {
      continue
    }
    edits.push({
      kind: "replace",
      start: cache.exprNode.start,
      end: cache.exprNode.end,
      text: cache.varName,
    })
  }

  for (const { node, regions } of plan.dynamicSlotWraps) {
    edits.push({
      kind: "dynamicSlotWrap",
      start: node.start,
      end: node.end,
      regions: formatRegionsLiteral(regions),
    })
  }

  edits.push(
    ...templateCodegenImportEdits(plan.bodyNodes, source, plan.imports)
  )

  const moduleRenderCacheLines = plan.renderRootCacheDecls
    .filter((c) => c.tier === "module")
    .map((c) => `const ${c.varName} = ${c.codeExpr}`)
  if (plan.declarations || plan.regionElementLines.length > 0) {
    const hoistBlock = [
      "",
      ...(plan.declarations ? [plan.declarations] : []),
      ...plan.regionElementLines,
      "",
    ].join("\n")
    edits.push({
      kind: "appendRight",
      pos: plan.moduleInsertPos,
      text: hoistBlock,
    })
  }
  if (moduleRenderCacheLines.length > 0) {
    edits.push({
      kind: "appendRight",
      pos: source.length,
      text: `\n${moduleRenderCacheLines.join("\n")}\n`,
    })
  }

  return { edits, imports: plan.imports }
}

export function buildHoistCodegenPlan(
  ast: ProgramNode,
  source: string,
  opts: AnalyzeJsxHoistingOpts
): CodegenPlan {
  const analyzed = analyzeJsxHoisting(ast, source, opts)
  if (!analyzed) return emptyCodegenPlan()
  return hoistPlanToEdits(analyzed, source, opts.templateAbsorbed)
}

/** @deprecated Use buildHoistCodegenPlan via jsxHoistPipeline */
export function prepareJSXHoisting(ctx: TransformCTX): void {
  const source = ctx.code.toString()
  const plan = buildHoistCodegenPlan(ctx.ast, source, {
    templateAbsorbed: new Set(),
    templateHoleNodes: new Set(),
    templatePlan: null,
    deferByNode: new Map(),
  })
  applyCodegenPlan(ctx.code, plan)
}

function templateCodegenImportEdits(
  bodyNodes: AstNode[],
  source: string,
  flags: CodegenImportFlags
): SourceEdit[] {
  const needTagStaticChildrenList = flags.needTagStaticChildrenList
  const needRegionElement = flags.needRegionElement
  const needMarkHoisted = flags.needMarkHoisted
  const names: string[] = []
  if (needTagStaticChildrenList) names.push("tagStaticChildrenList")
  if (needRegionElement) names.push("regionElement")
  if (needMarkHoisted) names.push("markHoisted")
  if (names.length === 0) return []

  for (const node of bodyNodes) {
    if (node.type !== "ImportDeclaration") continue
    const src = node.source
    if (
      src?.type !== "Literal" ||
      typeof src.value !== "string" ||
      src.value !== "kiru/template"
    ) {
      continue
    }
    const end = node.end
    const slice = source.slice(node.start, end)
    const missing = names.filter((n) => !slice.includes(n))
    if (missing.length === 0) return []
    const braceFrom = slice.indexOf("} from")
    if (braceFrom === -1) return []
    const start = node.start + braceFrom
    return [
      {
        kind: "replace",
        start,
        end: start + "} from".length,
        text: `, ${missing.join(", ")} } from`,
      },
    ]
  }
  const insertAt = findModuleHoistInsertPosition(bodyNodes, source, new Set())
  return [
    {
      kind: "appendRight",
      pos: insertAt,
      text: `import { ${names.join(", ")} } from "kiru/template";\n`,
    },
  ]
}

function isCreateHoledTemplateCall(node: AstNode): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  return callee?.type === "Identifier" && callee.name === "createHoledTemplate"
}

/** Region array: direct element of `createHoledTemplate(_, [ … ])` holes list. */
function isCreateHoledTemplateRegionHole(
  arrayNode: AstNode,
  parent: AstNode | null,
  grandparent: AstNode | null
): boolean {
  if (arrayNode.type !== "ArrayExpression") return false
  if (!parent || parent.type !== "ArrayExpression") return false
  if (!grandparent || !isCreateHoledTemplateCall(grandparent)) return false
  const holesArg = (grandparent as { arguments?: AstNode[] }).arguments?.[1]
  return holesArg === parent
}

function canHoistRegionArray(arrayNode: AstNode, ctx: AnalysisCtx): boolean {
  if (arrayNode.type !== "ArrayExpression") return false
  if (expressionReferencesBinding(arrayNode, ctx, blocksModuleHoist))
    return false
  const elems = (
    (arrayNode as { elements?: (AstNode | null)[] }).elements ?? []
  ).filter(Boolean) as AstNode[]
  if (elems.length === 0) return false
  for (const elem of elems) {
    if (!canHoistToModule(elem, ctx)) return false
  }
  return true
}

function isFullyStaticRegionArray(
  arrayNode: AstNode,
  ctx: AnalysisCtx
): boolean {
  if (arrayNode.type !== "ArrayExpression") return false
  const elems = (
    (arrayNode as { elements?: (AstNode | null)[] }).elements ?? []
  ).filter(Boolean) as AstNode[]
  for (const elem of elems) {
    if (!isJsxFactoryCall(elem, ctx)) return false
    if (!isIntrinsicJsxTag(elem.arguments?.[0])) return false
    if (!isHoistableJsxCall(elem, ctx, true)) return false
    if (subtreeHasImpureCall(elem, ctx)) return false
  }
  return elems.length > 0
}

function isDirectChildOfAnyArray(
  callNode: AstNode,
  arrays: Set<AstNode>
): boolean {
  for (const arr of arrays) {
    if (arr.type !== "ArrayExpression") continue
    for (const elem of (arr as { elements?: (AstNode | null)[] }).elements ??
      []) {
      if (elem === callNode) return true
    }
  }
  return false
}

function filterMaximalHoistCandidates(calls: AstNode[]): AstNode[] {
  return calls.filter(
    (call) =>
      !calls.some(
        (other) =>
          other !== call &&
          other.start <= call.start &&
          other.end >= call.end &&
          (other.start < call.start || other.end > call.end)
      )
  )
}

function isIntrinsicJsxTag(typeArg: AstNode | null | undefined): boolean {
  return typeArg?.type === "Literal" && typeof typeArg.value === "string"
}

function blocksForTier(tier: HoistTier): BindingBlocksFn {
  return tier === "module" ? blocksModuleHoist : blocksSetupHoist
}

function canHoistToModule(callNode: AstNode, ctx: AnalysisCtx): boolean {
  if (!isJsxFactoryCall(callNode, ctx)) return false
  if (!isIntrinsicJsxTag(callNode.arguments?.[0])) return false
  if (!isHoistableJsxCall(callNode, ctx, false, "module")) return false
  if (expressionReferencesBinding(callNode, ctx, blocksModuleHoist))
    return false
  if (subtreeHasImpureCall(callNode, ctx)) return false
  return true
}

function canHoistToSetup(callNode: AstNode, ctx: AnalysisCtx): boolean {
  if (!isJsxFactoryCall(callNode, ctx)) return false
  if (!isIntrinsicJsxTag(callNode.arguments?.[0])) return false
  if (!isHoistableJsxCall(callNode, ctx, false, "setup")) return false
  if (expressionReferencesBinding(callNode, ctx, blocksSetupHoist)) return false
  if (subtreeHasImpureCall(callNode, ctx)) return false
  return true
}

function nodeContains(outer: AstNode, inner: AstNode): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

function isStrictlyInsideAnyNode(
  node: AstNode,
  containers: Set<AstNode>
): boolean {
  for (const outer of containers) {
    if (outer !== node && nodeContains(outer, node)) return true
  }
  return false
}

function dedupeSetupHoistCandidates(
  candidates: SetupHoistCandidate[]
): SetupHoistCandidate[] {
  const byRoot = new Map<number, SetupHoistCandidate>()
  for (const c of candidates) {
    byRoot.set(c.rootJsx.start, c)
  }
  return [...byRoot.values()]
}

function dedupeSetupHolePayloadCandidates(
  candidates: SetupHolePayloadCandidate[]
): SetupHolePayloadCandidate[] {
  const byExpr = new Map<number, SetupHolePayloadCandidate>()
  for (const c of candidates) {
    byExpr.set(c.exprNode.start, c)
  }
  return [...byExpr.values()]
}

function renderCacheTierToHoistTier(tier: RenderRootCacheTier): HoistTier {
  return tier === "module" ? "module" : "setup"
}

function collectRenderRootCacheDecls(
  callIndex: ProgramCallIndex,
  source: string,
  deferByNode: Map<AstNode, string>,
  hoistByNode: Map<AstNode, string>,
  moduleComponentNames: Set<string>,
  templatePlan: AnalyzeJsxHoistingOpts["templatePlan"],
  allocVarName: () => string
): RenderRootCacheDecl[] {
  const decls: RenderRootCacheDecl[] = []
  const claimed = new Set<number>()

  const tryClaimRenderRoot = (
    exprNode: AstNode,
    factoryVar: string,
    holeNodes: AstNode[],
    regions: import("kiru/template").CompileRegion[],
    bindings: import("kiru/template").TemplateBindingDescriptor[],
    bindingHosts: TemplateBindingHost[],
    setupInsert: AstNode | null,
    componentInsert: AstNode | null,
    resolve: (name: string) => BindingInfo | null
  ): void => {
    if (claimed.has(exprNode.start)) return
    if (!setupInsert && !componentInsert) return
    if (holeNodes.length === 0 && !isCreateHoledTemplateCall(exprNode)) return

    const tiers: RenderRootCacheTier[] = ["module"]
    if (componentInsert) tiers.push("componentBody")
    if (setupInsert) tiers.push("setupReturn")

    for (const tier of tiers) {
      const built = tryBuildRenderRootCacheDecl(
        exprNode,
        factoryVar,
        holeNodes,
        regions,
        bindings,
        bindingHosts,
        tier,
        setupInsert,
        componentInsert,
        resolve,
        source,
        deferByNode,
        hoistByNode,
        moduleComponentNames,
        allocVarName
      )
      if (!built) continue
      decls.push(built)
      claimed.add(exprNode.start)
      break
    }
  }

  if (templatePlan) {
    for (const binding of templatePlan.bindings) {
      const site = callIndex.getCall(binding.node.start)
      if (!site) continue
      tryClaimRenderRoot(
        binding.node,
        binding.varName,
        binding.holeNodes,
        binding.regions,
        binding.bindings,
        binding.bindingHosts,
        site.setupInsertBefore,
        site.componentInsertBefore,
        site.resolve
      )
    }
  }

  callIndex.forEachCall((site) => {
    const node = site.node
    if (!isCreateHoledTemplateCall(node)) return
    if (claimed.has(node.start)) return

    const holesArg = node.arguments?.[1]
    if (!holesArg || holesArg.type !== "ArrayExpression") return
    const holeNodes = (
      (holesArg as { elements?: (AstNode | null)[] }).elements ?? []
    ).filter(Boolean) as AstNode[]
    const factory = node.arguments?.[0]
    const factoryVar =
      factory?.type === "Identifier" && factory.name
        ? factory.name
        : sliceNode(source, factory!, deferByNode)
    const regions: import("kiru/template").CompileRegion[] = []
    const bindings: import("kiru/template").TemplateBindingDescriptor[] = []
    const bindingHosts: TemplateBindingHost[] = []
    tryClaimRenderRoot(
      node,
      factoryVar,
      holeNodes,
      regions,
      bindings,
      bindingHosts,
      site.setupInsertBefore,
      site.componentInsertBefore,
      site.resolve
    )
  })

  return decls
}

function tryBuildRenderRootCacheDecl(
  exprNode: AstNode,
  factoryVar: string,
  holeNodes: AstNode[],
  regions: import("kiru/template").CompileRegion[],
  bindings: import("kiru/template").TemplateBindingDescriptor[],
  bindingHosts: TemplateBindingHost[],
  tier: RenderRootCacheTier,
  setupInsert: AstNode | null,
  componentInsert: AstNode | null,
  resolve: (name: string) => BindingInfo | null,
  source: string,
  deferByNode: Map<AstNode, string>,
  hoistByNode: Map<AstNode, string>,
  moduleComponentNames: Set<string>,
  allocVarName: () => string
): RenderRootCacheDecl | null {
  if (tier === "setupReturn" && !setupInsert) return null
  if (tier === "componentBody" && !componentInsert) return null

  const scopedAnalysis = createAnalysisCtx(resolve)
  const hoistTier = renderCacheTierToHoistTier(tier)

  const foldedHoleNodes = new Set<AstNode>()
  const inlinedJsxNodes = new Set<AstNode>()
  const holeCodes: string[] = []

  for (const hole of holeNodes) {
    const folded = foldRenderRootHole(
      hole,
      hoistTier,
      scopedAnalysis,
      source,
      deferByNode,
      hoistByNode,
      moduleComponentNames
    )
    if (!folded) return null
    holeCodes.push(folded.code)
    for (const n of folded.foldedNodes) foldedHoleNodes.add(n)
    for (const n of folded.inlinedJsxNodes) inlinedJsxNodes.add(n)
  }

  const regionsPart =
    regions.length > 0 ? `, ${formatRegionsLiteral(regions)}` : ""
  const bindingsPart =
    bindings.length > 0 ? `, ${formatTemplateBindingsLiteral(bindings)}` : ""
  const payloadsPart =
    bindingHosts.length > 0
      ? `, ${formatBindingPayloadsLiteral(
          formatBindingPayloadSlots(
            bindingHosts,
            source,
            deferByNode,
            hoistByNode
          )
        )}`
      : ""
  const codeExpr = `createHoledTemplate(${factoryVar}, [${holeCodes.join(
    ", "
  )}]${regionsPart}${bindingsPart}${payloadsPart})`

  const insertBefore =
    tier === "module"
      ? null
      : tier === "componentBody"
      ? componentInsert
      : setupInsert

  return {
    exprNode,
    tier,
    insertBefore,
    varName: allocVarName(),
    codeExpr,
    foldedHoleNodes,
    inlinedJsxNodes,
  }
}

function foldRenderRootHole(
  hole: AstNode,
  hoistTier: HoistTier,
  ctx: AnalysisCtx,
  source: string,
  deferByNode: Map<AstNode, string>,
  hoistByNode: Map<AstNode, string>,
  moduleComponentNames: Set<string>
): {
  code: string
  foldedNodes: AstNode[]
  inlinedJsxNodes: AstNode[]
} | null {
  const foldedNodes: AstNode[] = []
  const inlinedJsxNodes: AstNode[] = []

  const conditionalExpr = extractConditionalTemplateHole(hole, ctx)
  if (conditionalExpr) {
    if (!canHoistConditionalHoleExpr(conditionalExpr, ctx, hoistTier))
      return null
    foldedNodes.push(conditionalExpr)
    return {
      code: lazyConditionalHoleCodeExpr(source, conditionalExpr, deferByNode),
      foldedNodes,
      inlinedJsxNodes,
    }
  }

  if (hole.type === "ArrayExpression") {
    if (expressionReferencesBinding(hole, ctx, blocksForTier(hoistTier)))
      return null
    if (conditionalHoleHasImpureCall(hole, ctx)) return null
    foldedNodes.push(hole)
    return {
      code: sliceNode(source, hole, deferByNode),
      foldedNodes,
      inlinedJsxNodes,
    }
  }

  const payload = extractSetupHoistableHolePayload(hole, ctx)
  if (!payload) return null

  const { exprNode, jsxNode } = payload
  const typeArg = jsxNode.arguments?.[0]
  const isComponent =
    typeArg &&
    isComponentJsxTag(typeArg, ctx, moduleComponentNames) &&
    !isIntrinsicJsxTag(typeArg)

  if (isComponent) {
    const kVar = hoistByNode.get(jsxNode)
    if (kVar) {
      foldedNodes.push(exprNode)
      return { code: kVar, foldedNodes, inlinedJsxNodes }
    }
    if (hoistTier === "module") {
      if (
        !canHoistComponentCallToModule(jsxNode, ctx, moduleComponentNames) &&
        !canHoistToModule(jsxNode, ctx)
      ) {
        return null
      }
    } else if (!canHoistToSetup(jsxNode, ctx)) {
      return null
    }
    foldedNodes.push(exprNode)
    return {
      code: sliceNode(source, exprNode, deferByNode),
      foldedNodes,
      inlinedJsxNodes,
    }
  }

  if (hoistTier === "module") {
    if (!canHoistToModule(jsxNode, ctx)) return null
  } else if (!canHoistToSetup(jsxNode, ctx)) {
    return null
  }

  if (hoistByNode.has(jsxNode)) {
    inlinedJsxNodes.push(jsxNode)
  }
  foldedNodes.push(exprNode)
  return {
    code: sliceNode(source, exprNode, deferByNode),
    foldedNodes,
    inlinedJsxNodes,
  }
}

function findSetupHolePayloadCandidates(
  createHoledTemplateCall: AstNode,
  ctx: AnalysisCtx,
  insertBefore: AstNode
): SetupHolePayloadCandidate[] {
  if (!isCreateHoledTemplateCall(createHoledTemplateCall)) return []
  const holesArg = createHoledTemplateCall.arguments?.[1]
  if (!holesArg || holesArg.type !== "ArrayExpression") return []
  const out: SetupHolePayloadCandidate[] = []
  for (const hole of (holesArg as { elements?: (AstNode | null)[] }).elements ??
    []) {
    if (!hole) continue
    const conditionalExpr = extractConditionalTemplateHole(hole, ctx)
    if (
      conditionalExpr &&
      canHoistConditionalHoleExpr(conditionalExpr, ctx, "setup")
    ) {
      out.push({
        exprNode: conditionalExpr,
        jsxNode: conditionalExpr,
        insertBefore,
        resolve: ctx.resolve,
        isConditional: true,
      })
      continue
    }
    const candidate = extractSetupHoistableHolePayload(hole, ctx)
    if (!candidate) continue
    out.push({
      exprNode: candidate.exprNode,
      jsxNode: candidate.jsxNode,
      insertBefore,
      resolve: ctx.resolve,
    })
  }
  return out
}

function isElementOfRegionArrayHole(
  target: AstNode,
  holeNodes: AstNode[]
): boolean {
  for (const hole of holeNodes) {
    if (hole.type !== "ArrayExpression") continue
    for (const elem of (hole as { elements?: (AstNode | null)[] }).elements ??
      []) {
      if (elem === target) return true
    }
  }
  return false
}

function expandTemplateHoleHoistTargets(
  hole: AstNode,
  analysis: AnalysisCtx
): AstNode[] {
  if (hole.type === "ArrayExpression") {
    const targets: AstNode[] = []
    for (const elem of (hole as { elements?: (AstNode | null)[] }).elements ??
      []) {
      if (!elem || elem.type !== "CallExpression") continue
      if (!isJsxFactoryCall(elem, analysis) && !looksLikeJsxFactoryCall(elem)) {
        continue
      }
      targets.push(elem)
    }
    return targets
  }
  const conditional = extractConditionalTemplateHole(hole, analysis)
  if (conditional) return [conditional]
  const payload = extractSetupHoistableHolePayload(hole, analysis)
  return payload ? [payload.jsxNode] : []
}

function extractSetupHoistableHolePayload(
  node: AstNode,
  ctx: AnalysisCtx
): { exprNode: AstNode; jsxNode: AstNode } | null {
  if (
    node.type === "CallExpression" &&
    (isJsxFactoryCall(node, ctx) || looksLikeJsxFactoryCall(node))
  ) {
    return { exprNode: node, jsxNode: node }
  }
  if (node.type !== "CallExpression") return null
  const callee = node.callee
  if (callee?.type !== "Identifier" || callee.name !== "regionElement")
    return null
  const jsxNode = node.arguments?.[0]
  if (!jsxNode || jsxNode.type !== "CallExpression") return null
  if (!(isJsxFactoryCall(jsxNode, ctx) || looksLikeJsxFactoryCall(jsxNode))) {
    return null
  }
  return { exprNode: node, jsxNode }
}

function looksLikeJsxFactoryCall(node: AstNode): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  return (
    callee?.type === "Identifier" &&
    (callee.name === "jsx" ||
      callee.name === "jsxs" ||
      callee.name === "jsxDEV")
  )
}

function canHoistHolePayloadToSetup(
  candidate: SetupHolePayloadCandidate
): boolean {
  const ctx = createAnalysisCtx(candidate.resolve)
  if (candidate.isConditional) {
    // Conditional holes are validated for tier compatibility when they are
    // collected (with a scoped resolver). Re-validating here would require
    // scoped binding resolution, which we no longer have once traversal ends.
    return true
  }
  if (!isIntrinsicJsxTag(candidate.jsxNode.arguments?.[0])) return false
  if (subtreeHasImpureCallForSetupHole(candidate.jsxNode, ctx)) return false
  return true
}

function isConditionalHoleShape(node: AstNode): boolean {
  if (
    node.type === "ConditionalExpression" ||
    node.type === "LogicalExpression"
  ) {
    return true
  }
  if (node.type === "ArrowFunctionExpression") {
    const params = (node as { params?: AstNode[] }).params ?? []
    if (params.length !== 0) return false
    const body = (node as { body?: AstNode }).body
    if (!body || body.type === "BlockStatement") return false
    return (
      body.type === "ConditionalExpression" || body.type === "LogicalExpression"
    )
  }
  return false
}

function extractConditionalTemplateHole(
  node: AstNode,
  ctx: AnalysisCtx
): AstNode | null {
  if (!isConditionalHoleShape(node)) return null
  if (classifyChildSlotRegion(node, ctx).kind !== "conditional") return null
  return node
}

function canHoistConditionalHoleExpr(
  node: AstNode,
  ctx: AnalysisCtx,
  tier: HoistTier
): boolean {
  if (!extractConditionalTemplateHole(node, ctx)) return false
  if (expressionReferencesBinding(node, ctx, blocksForTier(tier))) return false
  return !conditionalHoleHasImpureCall(node, ctx)
}

function conditionalHoleHasImpureCall(
  node: AstNode,
  ctx: AnalysisCtx
): boolean {
  let found = false
  AST.walk(node, {
    ArrowFunctionExpression: (n, walkCtx) => {
      const params = (n as { params?: AstNode[] }).params ?? []
      if (params.length > 0) {
        walkCtx.skipDescent()
        return
      }
      const body = (n as { body?: AstNode }).body
      if (!body || body.type === "BlockStatement") {
        walkCtx.skipDescent()
        return
      }
      if (
        body.type === "ConditionalExpression" ||
        body.type === "LogicalExpression"
      ) {
        return
      }
      walkCtx.skipDescent()
    },
    FunctionExpression: (_n, walkCtx) => {
      walkCtx.skipDescent()
    },
    CallExpression: (n, walkCtx) => {
      if (isJsxFactoryCall(n, ctx) || looksLikeJsxFactoryCall(n)) return
      if (isReactiveSignalRead(n, ctx)) return
      if (isSignalFactoryCall(n, ctx.resolve)) return
      found = true
      walkCtx.exit()
    },
  })
  return found
}

function lazyConditionalHoleCodeExpr(
  source: string,
  node: AstNode,
  deferByNode: Map<AstNode, string>
): string {
  const slice = sliceNode(source, node, deferByNode)
  // When `deferSlotReads` already wrapped this expression, we must not wrap
  // again or we'd end up with a nested `() => () => (...)`.
  if (deferByNode.has(node)) return slice
  if (node.type === "ArrowFunctionExpression") {
    const params = (node as { params?: AstNode[] }).params ?? []
    if (params.length === 0) return slice
  }
  return `() => (${slice})`
}

function isComponentJsxTag(
  typeArg: AstNode | null | undefined,
  ctx: AnalysisCtx,
  moduleComponentNames: Set<string>
): boolean {
  if (typeArg?.type !== "Identifier" || !typeArg.name) return false
  const binding = ctx.resolve(typeArg.name)
  if (binding?.kind === "import" || binding?.kind === "moduleStatic")
    return true
  return moduleComponentNames.has(typeArg.name)
}

function collectModuleComponentNames(bodyNodes: AstNode[]): Set<string> {
  const out = new Set<string>()
  for (const stmt of bodyNodes) {
    // Only include function declarations here.
    // `const Foo = () => ...` components have TDZ if we hoist module-level
    // payloads that reference them before their declaration executes.
    if (stmt.type === "FunctionDeclaration") {
      const id = (stmt as { id?: AstNode }).id
      if (id?.type === "Identifier" && id.name) out.add(id.name)
      continue
    }
    if (stmt.type === "ExportNamedDeclaration") {
      const decl = stmt.declaration
      if (decl?.type === "FunctionDeclaration") {
        const id = decl.id
        if (id?.type === "Identifier" && id.name) out.add(id.name)
      }
      continue
    }
  }
  return out
}

function canHoistComponentCallToModule(
  callNode: AstNode,
  ctx: AnalysisCtx,
  moduleComponentNames: Set<string>
): boolean {
  if (!isJsxFactoryCall(callNode, ctx)) return false
  if (!isComponentJsxTag(callNode.arguments?.[0], ctx, moduleComponentNames))
    return false
  if (!isHoistableJsxCall(callNode, ctx, false, "module")) return false
  if (expressionReferencesBinding(callNode, ctx, blocksModuleHoist))
    return false
  if (subtreeHasImpureCall(callNode, ctx)) return false
  return true
}

function subtreeHasImpureCallForSetupHole(
  node: AstNode,
  ctx: AnalysisCtx
): boolean {
  let found = false
  AST.walk(node, {
    ArrowFunctionExpression: (_n, walkCtx) => {
      // Deferred callbacks are not executed during render-time expression evaluation.
      walkCtx.skipDescent()
    },
    FunctionExpression: (_n, walkCtx) => {
      // Deferred callbacks are not executed during render-time expression evaluation.
      walkCtx.skipDescent()
    },
    CallExpression: (n, walkCtx) => {
      if (isJsxFactoryCall(n, ctx) || looksLikeJsxFactoryCall(n)) return
      if (isSignalFactoryCall(n, ctx.resolve)) return
      found = true
      walkCtx.exit()
    },
  })
  return found
}

/** JSX roots that setup-scope hoisting will absorb (skip template shells on these subtrees). */
export function collectSetupHoistRenderRoots(
  bodyNodes: AstNode[]
): Set<AstNode> {
  const resolve = buildProgramBindingResolve(bodyNodes)
  const analysis = createAnalysisCtx(resolve)
  const roots = new Set<AstNode>()
  walkProgramBody(bodyNodes, {
    onCallExpression: (node, walkCtx) => {
      const insertBefore = findSetupRenderInsertBefore(node, walkCtx)
      if (
        insertBefore &&
        isJsxFactoryCall(node, analysis) &&
        canHoistToSetup(node, analysis)
      ) {
        roots.add(node)
      }
    },
  })
  return roots
}

function isJsxFactoryCall(callNode: AstNode, ctx: AnalysisCtx): boolean {
  return ctx.isJsxProd(callNode) || ctx.isJsxDev(callNode)
}

function isHoistableJsxCall(
  callNode: AstNode,
  ctx: AnalysisCtx,
  fullyStatic: boolean,
  tier: HoistTier = "module"
): boolean {
  if (!isJsxFactoryCall(callNode, ctx)) return false

  const typeArg = callNode.arguments?.[0]
  if (!typeArg) return false

  const propsArg = callNode.arguments?.[1]
  if (!isHoistableProps(propsArg, ctx, fullyStatic, tier)) return false

  const keyArg = callNode.arguments?.[2]
  if (!isAbsentOrStaticJsxKeyArg(keyArg)) return false

  if (ctx.isJsxDev(callNode)) {
    const isStaticChildrenArg = callNode.arguments?.[3]
    if (
      isStaticChildrenArg !== undefined &&
      isStaticChildrenArg !== null &&
      (isStaticChildrenArg.type !== "Literal" ||
        typeof isStaticChildrenArg.value !== "boolean")
    ) {
      return false
    }
    const sourceArg = callNode.arguments?.[4]
    if (sourceArg && !isStaticLiteral(sourceArg)) return false
    const selfArg = callNode.arguments?.[5]
    if (selfArg && !isHoistableJsxDevSelfArg(selfArg)) return false
  }

  return true
}

function isHoistableProps(
  propsArg: AstNode | undefined | null,
  ctx: AnalysisCtx,
  fullyStatic: boolean,
  tier: HoistTier = "module"
): boolean {
  if (!propsArg) return true
  if (propsArg.type === "Literal") {
    return propsArg.value === null || propsArg.value === undefined
  }
  if (propsArg.type !== "ObjectExpression") return false

  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") return false
    const key =
      prop.key?.name ??
      (typeof prop.key?.value === "string" ? prop.key.value : undefined)
    const value = prop.value as AstNode
    if (key === "children") {
      if (!isHoistableChildValue(value, ctx, fullyStatic, tier)) return false
    } else if (!isHoistablePropValue(value, ctx, fullyStatic, tier)) {
      return false
    }
  }
  return true
}

function isHoistablePropValue(
  value: AstNode,
  ctx: AnalysisCtx,
  fullyStatic: boolean,
  tier: HoistTier = "module"
): boolean {
  if (isInlineFunctionExpression(value)) {
    return isHoistableInlineFunction(value, ctx, blocksForTier(tier))
  }
  if (isStaticLiteral(value)) return true
  if (value.type !== "Identifier" || !value.name) return false
  const binding = ctx.resolve(value.name)
  if (binding?.kind === "moduleStatic" || binding?.kind === "moduleSignal") {
    return true
  }
  if (fullyStatic) return false
  return binding != null && !blocksForTier(tier)(binding)
}

function isHoistableChildValue(
  node: AstNode,
  ctx: AnalysisCtx,
  fullyStatic: boolean,
  tier: HoistTier = "module"
): boolean {
  if (!node) return true
  if (isInlineFunctionExpression(node)) {
    return isHoistableInlineFunction(node, ctx, blocksForTier(tier))
  }
  if (node.type === "CallExpression") {
    if (isNonTrackingSignalMemberCall(node, ctx)) return true
    if (fullyStatic) {
      if (isReactiveSignalRead(node, ctx)) return false
      if (isImpureCall(node, ctx)) return false
      return isHoistableJsxCall(node, ctx, true, tier)
    }
    if (isHoistableJsxCall(node, ctx, false, tier)) return true
    if (isImpureCall(node, ctx)) return false
    return !expressionReferencesBinding(node, ctx, blocksForTier(tier))
  }
  if (node.type === "ArrayExpression") {
    for (const elem of (node as { elements?: (AstNode | null)[] }).elements ??
      []) {
      if (!elem) continue
      if (!isHoistableChildValue(elem, ctx, fullyStatic, tier)) return false
    }
    return true
  }
  if (isNonTrackingSignalMemberRead(node, ctx)) return true
  if (fullyStatic) {
    return isFullyStaticExpression(node, ctx)
  }
  return isHoistableExpression(node, ctx, tier)
}

function isHoistableExpression(
  node: AstNode,
  ctx: AnalysisCtx,
  tier: HoistTier = "module"
): boolean {
  if (isStaticLiteral(node)) return true
  if (node.type === "Identifier") {
    const binding = ctx.resolve(node.name!)
    if (isModuleSignalBinding(binding)) return true
    return !blocksForTier(tier)(binding)
  }
  return false
}

function isHoistableInlineFunction(
  node: AstNode,
  ctx: AnalysisCtx,
  blocks: BindingBlocksFn
): boolean {
  const body =
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression"
      ? (node as { body?: AstNode }).body
      : undefined
  if (!body) return false
  return !expressionReferencesBinding(body, ctx, blocks)
}

function isFullyStaticExpression(node: AstNode, ctx: AnalysisCtx): boolean {
  if (isStaticLiteral(node)) return true
  if (node.type === "Identifier") {
    return isModuleLevelIdentifier(node, ctx)
  }
  if (node.type === "CallExpression") {
    if (isNonTrackingSignalMemberCall(node, ctx)) return true
    if (isReactiveSignalRead(node, ctx)) return false
    if (isImpureCall(node, ctx)) return false
    return isHoistableJsxCall(node, ctx, true)
  }
  return false
}

function isModuleLevelIdentifier(node: AstNode, ctx: AnalysisCtx): boolean {
  if (node.type !== "Identifier" || !node.name) return false
  const binding = ctx.resolve(node.name)
  return binding?.kind === "moduleStatic" || binding?.kind === "moduleSignal"
}

function isInlineFunctionExpression(node: AstNode): boolean {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression"
  )
}

function subtreeHasImpureCall(node: AstNode, ctx: AnalysisCtx): boolean {
  let found = false
  AST.walk(node, {
    CallExpression: (n, walkCtx) => {
      if (isImpureCall(n, ctx)) {
        found = true
        walkCtx.exit()
      }
    },
  })
  return found
}

function expressionReferencesBinding(
  node: AstNode,
  ctx: AnalysisCtx,
  blocks: BindingBlocksFn
): boolean {
  let blocked = false
  AST.walk(node, {
    Identifier: (n, walkCtx) => {
      if (!n.name) return
      if (n.name === "this" || n.name === "undefined") return
      const binding = ctx.resolve(n.name)
      if (binding && blocks(binding)) {
        blocked = true
        walkCtx.exit()
      }
    },
  })
  return blocked
}

function isImpureCall(node: AstNode, ctx: AnalysisCtx): boolean {
  if (node.type !== "CallExpression") return false
  if (isJsxFactoryCall(node, ctx)) return false
  if (isNonTrackingSignalMemberCall(node, ctx)) return false
  if (isSignalFactoryCall(node, ctx.resolve)) return false // signal() factory, not read
  return true
}

function isReactiveSignalRead(node: AstNode, ctx: AnalysisCtx): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee?.type !== "Identifier" || !callee.name) return false
  const binding = ctx.resolve(callee.name)
  return binding?.kind === "moduleSignal" || binding?.kind === "setupConst"
}

function isNonTrackingSignalMemberCall(
  node: AstNode,
  ctx: AnalysisCtx
): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee?.type !== "MemberExpression") return false
  const obj = callee.object
  const prop = callee.property
  if (obj?.type !== "Identifier" || !obj.name || prop?.type !== "Identifier") {
    return false
  }
  const binding = ctx.resolve(obj.name)
  if (binding?.kind !== "moduleSignal" && binding?.kind !== "setupConst") {
    return false
  }
  return NON_TRACKING_SIGNAL_METHODS.has(prop.name!)
}

function isNonTrackingSignalMemberRead(
  node: AstNode,
  ctx: AnalysisCtx
): boolean {
  if (node.type !== "MemberExpression") return false
  const obj = node.object
  const prop = node.property
  if (obj?.type !== "Identifier" || !obj.name || prop?.type !== "Identifier") {
    return false
  }
  const binding = ctx.resolve(obj.name)
  if (binding?.kind !== "moduleSignal" && binding?.kind !== "setupConst") {
    return false
  }
  return prop.name === "peek"
}

function isAbsentOrStaticJsxKeyArg(node: AstNode | undefined | null): boolean {
  if (node === undefined || node === null) return true
  if (isStaticLiteral(node)) return true
  if (node.type === "Identifier" && node.name === "undefined") return true
  if (node.type === "UnaryExpression") {
    const op = (node as { operator?: string }).operator
    const arg = (node as { argument?: AstNode }).argument
    return op === "void" && arg?.type === "Literal" && arg.value === 0
  }
  return false
}

function isHoistableJsxDevSelfArg(node: AstNode): boolean {
  if (node.type === "ThisExpression") return true
  if (node.type === "Literal") {
    return node.value === null || node.value === undefined
  }
  if (node.type === "UnaryExpression") {
    const arg = (node as { argument?: AstNode }).argument
    return (
      (node as { operator?: string }).operator === "void" &&
      arg?.type === "Literal" &&
      arg.value === 0
    )
  }
  if (node.type === "Identifier") {
    return node.name === "undefined" || node.name === "this"
  }
  return false
}

function collectReferencedModuleBindings(
  allHoistables: Hoistable[],
  resolve: (name: string) => BindingInfo | null
): Set<string> {
  const names = new Set<string>()
  for (const h of allHoistables) {
    AST.walk(h.node, {
      Identifier: (n) => {
        if (!n.name) return
        const kind = resolve(n.name)?.kind
        if (kind === "moduleStatic" || kind === "moduleSignal") {
          names.add(n.name)
        }
      },
    })
  }
  return names
}

function moduleBindingDeclaredInNode(
  node: AstNode,
  moduleDeps: Set<string>
): boolean {
  const checkDecl = (decl: AstNode) => {
    if (decl.type !== "VariableDeclarator") return false
    const id = decl.id
    return id?.type === "Identifier" && !!id.name && moduleDeps.has(id.name)
  }

  if (node.type === "VariableDeclaration") {
    return (node.declarations ?? []).some(checkDecl)
  }
  if (
    node.type === "ExportNamedDeclaration" &&
    node.declaration?.type === "VariableDeclaration"
  ) {
    return (node.declaration.declarations ?? []).some(checkDecl)
  }
  return false
}

/** Insert hoisted `const $kN` after imports and module bindings they reference. */
function findModuleHoistInsertPosition(
  bodyNodes: AstNode[],
  source: string,
  moduleDeps: Set<string>
): number {
  let insertAt = 0
  for (const node of bodyNodes) {
    // `minHoistStart` used to restrict insertion to bindings that appear
    // before the earliest hoist candidate. That breaks TDZ correctness when
    // a hoisted payload references a `const` binding declared later in the
    // file (e.g. `const $k = jsxDEV(LateConst, ...)` above `const LateConst = ...`).
    // Hoisted payloads run at module evaluation time, so we must insert after
    // all referenced module bindings, regardless of source order.

    if (node.type === "ImportDeclaration") {
      insertAt = Math.max(insertAt, node.end)
      continue
    }

    if (moduleDeps.size > 0 && moduleBindingDeclaredInNode(node, moduleDeps)) {
      insertAt = Math.max(insertAt, node.end)
    }
  }
  while (insertAt < source.length && /\s/.test(source[insertAt]!)) {
    insertAt++
  }
  return insertAt
}

function jsxCallHasInlineFunctionProp(callNode: AstNode): boolean {
  const propsArg = callNode.arguments?.[1]
  if (!propsArg || propsArg.type !== "ObjectExpression") return false
  for (const prop of propsArg.properties ?? []) {
    if (prop.type !== "Property") continue
    const key = prop.key
    const keyName =
      key?.type === "Identifier"
        ? key.name
        : key?.type === "Literal" && typeof key.value === "string"
        ? key.value
        : null
    if (keyName === "children") continue
    const propValue = prop.value as AstNode
    if (isInlineFunctionExpression(propValue)) return true
  }
  return false
}

function buildRegionElementWrap(
  node: AstNode,
  ctx: AnalysisCtx,
  expr: string,
  tier: HoistTier = "module"
): string | null {
  const regions = getCompileRegionsForJsxs(node, ctx)
  let flagsExpr: string | undefined
  if (
    isIntrinsicJsxTag(node.arguments?.[0]) &&
    isHoistableJsxCall(node, ctx, true, tier) &&
    !subtreeHasImpureCall(node, ctx) &&
    !jsxCallHasInlineFunctionProp(node) &&
    !regions?.length
  ) {
    flagsExpr = `${FLAG_HOISTED_BIT}`
  }
  if (!regions && flagsExpr === undefined) return null
  if (!regions && flagsExpr !== undefined) {
    return `markHoisted(${expr})`
  }
  const regionsLit = formatRegionsLiteral(regions!)
  if (flagsExpr !== undefined) {
    return `regionElement(${expr}, ${regionsLit}, ${flagsExpr})`
  }
  return `regionElement(${expr}, ${regionsLit})`
}

function buildRegionElementLines(
  allHoistables: Hoistable[],
  ctx: AnalysisCtx
): string[] {
  const lines: string[] = []
  for (const h of allHoistables) {
    if (h.node.type !== "ArrayExpression") continue
    const elems = (h.node as { elements?: (AstNode | null)[] }).elements ?? []
    for (let i = 0; i < elems.length; i++) {
      const elem = elems[i]
      if (!elem || elem.type !== "CallExpression") continue
      if (!isJsxFactoryCall(elem, ctx)) continue
      const elemExpr = `${h.varName}[${i}]`
      const wrap = buildRegionElementWrap(elem, ctx, elemExpr)
      if (wrap) {
        lines.push(`${h.varName}[${i}] = ${wrap}`)
      }
    }
  }
  return lines
}
