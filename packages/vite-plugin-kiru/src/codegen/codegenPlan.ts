import * as AST from "./ast.js"
import type { MagicString } from "./shared.js"

type AstNode = AST.AstNode

export type SourceEdit =
  | { kind: "replace"; start: number; end: number; text: string }
  | { kind: "dynamicSlotWrap"; start: number; end: number; regions: string }
  | { kind: "appendRight"; pos: number; text: string }
  | { kind: "appendLeft"; pos: number; text: string }
  | { kind: "prepend"; text: string }

export type CodegenImportFlags = {
  needTagStaticChildrenList: boolean
  needRegionElement: boolean
  needMarkHoisted: boolean
}

export type CodegenPlan = {
  edits: SourceEdit[]
  imports: CodegenImportFlags
}

export type DeferWrap = {
  node: AstNode
  text: string
}

export type DeferPlan = {
  wraps: DeferWrap[]
}

const emptyImports: CodegenImportFlags = {
  needTagStaticChildrenList: false,
  needRegionElement: false,
  needMarkHoisted: false,
}

export function emptyCodegenPlan(): CodegenPlan {
  return { edits: [], imports: { ...emptyImports } }
}

export function mergeCodegenPlans(...plans: CodegenPlan[]): CodegenPlan {
  const imports = { ...emptyImports }
  const edits: SourceEdit[] = []
  for (const p of plans) {
    edits.push(...p.edits)
    if (p.imports.needTagStaticChildrenList) {
      imports.needTagStaticChildrenList = true
    }
    if (p.imports.needRegionElement) imports.needRegionElement = true
    if (p.imports.needMarkHoisted) imports.needMarkHoisted = true
  }
  return { edits, imports }
}

/** Slice source for an AST node, applying a virtual defer wrap when present. */
export function sliceNode(
  source: string,
  node: AstNode,
  deferByNode?: ReadonlyMap<AstNode, string>
): string {
  const wrapped = deferByNode?.get(node)
  if (wrapped !== undefined) return wrapped
  return source.slice(node.start, node.end)
}

export function deferWrapMap(plan: DeferPlan): Map<AstNode, string> {
  return new Map(plan.wraps.map((w) => [w.node, w.text]))
}

export function deferPlanToEdits(plan: DeferPlan): SourceEdit[] {
  return plan.wraps.map((w) => ({
    kind: "replace" as const,
    start: w.node.start,
    end: w.node.end,
    text: w.text,
  }))
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd
}

function assertNoReplaceOverlaps(edits: SourceEdit[]): void {
  if (process.env.NODE_ENV === "production") return
  const replaces = edits.filter((e) => e.kind === "replace")
  for (let i = 0; i < replaces.length; i++) {
    const a = replaces[i]!
    if (a.kind !== "replace") continue
    for (let j = i + 1; j < replaces.length; j++) {
      const b = replaces[j]!
      if (b.kind !== "replace") continue
      if (rangesOverlap(a.start, a.end, b.start, b.end)) {
        throw new Error(
          `[vite-plugin-kiru]: overlapping codegen replaces at ${a.start}-${a.end} and ${b.start}-${b.end}`
        )
      }
    }
  }
}

/** Apply plan edits to a single MagicString (end-to-start for spans). */
export function applyCodegenPlan(code: MagicString, plan: CodegenPlan): void {
  assertNoReplaceOverlaps(plan.edits)

  for (const edit of plan.edits) {
    if (edit.kind === "prepend") {
      code.prepend(edit.text)
    }
  }

  const replaces = plan.edits
    .filter((e) => e.kind === "replace")
    .sort((a, b) => b.start - a.start)
  for (const { start, end, text } of replaces) {
    code.update(start, end, text)
  }

  const appendLeft = plan.edits
    .filter((e) => e.kind === "appendLeft")
    .sort((a, b) => b.pos - a.pos)
  for (const { pos, text } of appendLeft) {
    code.appendLeft(pos, text)
  }

  const appendRight = plan.edits
    .filter((e) => e.kind === "appendRight")
    .sort((a, b) => b.pos - a.pos)
  for (const { pos, text } of appendRight) {
    code.appendRight(pos, text)
  }

  const dynamicSlotWraps = plan.edits
    .filter((e) => e.kind === "dynamicSlotWrap")
    .sort((a, b) => b.start - a.start)
  for (const { start, end, regions } of dynamicSlotWraps) {
    const current = code.slice(start, end)
    code.update(start, end, `regionElement(${current}, ${regions})`)
  }
}

export function wrapDeferredExpr(source: string, node: AstNode): string {
  const expr = source.slice(node.start, node.end)
  return `() => (${expr})`
}
