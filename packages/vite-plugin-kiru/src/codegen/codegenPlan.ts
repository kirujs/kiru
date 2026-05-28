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

function normalizeSpanEdits(source: string, edits: SourceEdit[]): SourceEdit[] {
  const byRange = new Map<string, SourceEdit & { kind: "replace" }>()
  const rangeKey = (start: number, end: number) => `${start}:${end}`
  const replaces = edits.filter((e) => e.kind === "replace")
  const wraps = edits
    .filter((e) => e.kind === "dynamicSlotWrap")
    .sort((a, b) => a.end - a.start - (b.end - b.start))

  for (const replace of replaces) {
    const key = rangeKey(replace.start, replace.end)
    const existing = byRange.get(key)
    if (existing) {
      if (existing.text !== replace.text) {
        throw new Error(
          `[vite-plugin-kiru]: duplicate replace range with mismatched text at ${replace.start}-${replace.end}`
        )
      }
      continue
    }
    let skip = false
    for (const prior of Array.from(byRange.values())) {
      if (!rangesOverlap(replace.start, replace.end, prior.start, prior.end)) {
        continue
      }
      const replaceContainsPrior =
        replace.start <= prior.start && replace.end >= prior.end
      const priorContainsReplace =
        prior.start <= replace.start && prior.end >= replace.end
      if (replaceContainsPrior && !priorContainsReplace) {
        skip = true
        break
      }
      if (priorContainsReplace && !replaceContainsPrior) {
        byRange.delete(rangeKey(prior.start, prior.end))
        continue
      }
      throw new Error(
        `[vite-plugin-kiru]: overlapping codegen replaces at ${replace.start}-${replace.end} and ${prior.start}-${prior.end}`
      )
    }
    if (skip) continue
    byRange.set(key, { ...replace })
  }

  for (const wrap of wraps) {
    const key = rangeKey(wrap.start, wrap.end)
    const existing = byRange.get(key)
    if (existing) {
      existing.text = `regionElement(${existing.text}, ${wrap.regions})`
      byRange.set(key, existing)
      continue
    }

    const contained: (SourceEdit & { kind: "replace" })[] = []
    for (const replace of Array.from(byRange.values())) {
      if (!rangesOverlap(wrap.start, wrap.end, replace.start, replace.end))
        continue
      const fullyContains =
        replace.start >= wrap.start && replace.end <= wrap.end
      if (!fullyContains) {
        throw new Error(
          `[vite-plugin-kiru]: dynamicSlotWrap overlaps replace at ${wrap.start}-${wrap.end} and ${replace.start}-${replace.end}`
        )
      }
      contained.push(replace)
    }

    let wrappedSource = source.slice(wrap.start, wrap.end)
    contained.sort((a, b) => b.start - a.start)
    for (const replace of contained) {
      const localStart = replace.start - wrap.start
      const localEnd = replace.end - wrap.start
      wrappedSource =
        wrappedSource.slice(0, localStart) +
        replace.text +
        wrappedSource.slice(localEnd)
      byRange.delete(rangeKey(replace.start, replace.end))
    }
    byRange.set(key, {
      kind: "replace",
      start: wrap.start,
      end: wrap.end,
      text: `regionElement(${wrappedSource}, ${wrap.regions})`,
    })
  }

  const out: SourceEdit[] = []
  for (const edit of edits) {
    if (edit.kind === "replace" || edit.kind === "dynamicSlotWrap") continue
    out.push(edit)
  }
  out.push(...byRange.values())
  return out
}

/** Apply plan edits to a single MagicString (end-to-start for spans). */
export function applyCodegenPlan(code: MagicString, plan: CodegenPlan): void {
  const source = code.toString()
  const normalizedEdits = normalizeSpanEdits(source, plan.edits)
  assertNoReplaceOverlaps(normalizedEdits)

  for (const edit of normalizedEdits) {
    if (edit.kind === "prepend") {
      code.prepend(edit.text)
    }
  }

  const replaces = normalizedEdits
    .filter((e) => e.kind === "replace")
    .sort((a, b) => b.start - a.start)
  for (const { start, end, text } of replaces) {
    code.update(start, end, text)
  }

  const appendLeft = normalizedEdits
    .filter((e) => e.kind === "appendLeft")
    .sort((a, b) => b.pos - a.pos)
  for (const { pos, text } of appendLeft) {
    code.appendLeft(pos, text)
  }

  const appendRight = normalizedEdits
    .filter((e) => e.kind === "appendRight")
    .sort((a, b) => b.pos - a.pos)
  for (const { pos, text } of appendRight) {
    code.appendRight(pos, text)
  }
}

export function wrapDeferredExpr(source: string, node: AstNode): string {
  const expr = source.slice(node.start, node.end)
  return `() => (${expr})`
}
