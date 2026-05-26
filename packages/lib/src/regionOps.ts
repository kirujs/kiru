import type { CompileRegion, CompileRegionKind } from "./compileRegions.js"
import { __DEV__ } from "./env.js"
import { KiruError } from "./error.js"

export type RegionOpFallback = "insert" | "reconcileChildren" | "throw"

export type AnchorRegionCtx = {
  slotParent: Kiru.VNode
  holeChild: unknown
  existing: Kiru.VNode | null
  prepareExisting: () => void
  reconcileChildren: (
    parent: Kiru.VNode,
    children: unknown
  ) => Kiru.VNode | null
  updateSlot: (
    parent: Kiru.VNode,
    oldChild: Kiru.VNode | null,
    child: unknown
  ) => Kiru.VNode | null
}

export type SlotRegionCtx = {
  parent: Kiru.VNode
  oldChild: Kiru.VNode | null
  child: unknown
  updateSlot: (
    parent: Kiru.VNode,
    oldChild: Kiru.VNode | null,
    child: unknown
  ) => Kiru.VNode | null
  patchDynamicChildren: (
    parent: Kiru.VNode,
    children: unknown[]
  ) => Kiru.VNode | null
}

export type AnchorRegionOp = (ctx: AnchorRegionCtx) => Kiru.VNode | null
export type SlotRegionOp = (
  ctx: SlotRegionCtx
) => Kiru.VNode | null | "fallback"

function anchorTextOp(ctx: AnchorRegionCtx): Kiru.VNode | null {
  ctx.prepareExisting()
  const { slotParent, holeChild, existing } = ctx
  if (typeof holeChild === "function") {
    return ctx.updateSlot(slotParent, existing, holeChild)
  }
  if (
    holeChild !== null &&
    holeChild !== undefined &&
    !Array.isArray(holeChild) &&
    typeof holeChild !== "object"
  ) {
    return ctx.updateSlot(slotParent, existing, holeChild)
  }
  return ctx.reconcileChildren(slotParent, holeChild)
}

function anchorDefaultOp(ctx: AnchorRegionCtx): Kiru.VNode | null {
  ctx.prepareExisting()
  return ctx.reconcileChildren(ctx.slotParent, ctx.holeChild)
}

function slotTextOp(ctx: SlotRegionCtx): Kiru.VNode | null | "fallback" {
  const updated = ctx.updateSlot(ctx.parent, ctx.oldChild, ctx.child)
  if (updated === null) return "fallback"
  return updated
}

function slotComponentOp(ctx: SlotRegionCtx): Kiru.VNode | null | "fallback" {
  if (
    ctx.child !== null &&
    typeof ctx.child === "object" &&
    "type" in (ctx.child as object) &&
    typeof (ctx.child as Kiru.Element).type === "function"
  ) {
    const updated = ctx.updateSlot(ctx.parent, ctx.oldChild, ctx.child)
    if (updated === null) return "fallback"
    return updated
  }
  return slotDefaultOp(ctx)
}

function slotDefaultOp(ctx: SlotRegionCtx): Kiru.VNode | null | "fallback" {
  const updated = ctx.updateSlot(ctx.parent, ctx.oldChild, ctx.child)
  if (updated === null) return "fallback"
  return updated
}

function slotConditionalOp(ctx: SlotRegionCtx): Kiru.VNode | null | "fallback" {
  const updated = ctx.updateSlot(ctx.parent, ctx.oldChild, ctx.child)
  if (updated === null) return "fallback"
  return updated
}

function slotFragmentOp(ctx: SlotRegionCtx): Kiru.VNode | null | "fallback" {
  return slotDefaultOp(ctx)
}

export const anchorRegionOps: Record<CompileRegionKind, AnchorRegionOp> = {
  text: anchorTextOp,
  conditional: anchorDefaultOp,
  children: anchorDefaultOp,
  component: anchorDefaultOp,
  fragment: anchorDefaultOp,
  node: anchorDefaultOp,
  insert: anchorDefaultOp,
}

export const slotRegionOps: Record<CompileRegionKind, SlotRegionOp> = {
  text: slotTextOp,
  conditional: slotConditionalOp,
  component: slotComponentOp,
  fragment: slotFragmentOp,
  node: slotDefaultOp,
  insert: slotDefaultOp,
  children: slotDefaultOp,
}

const PROD_FALLBACK: RegionOpFallback = "reconcileChildren"

function resolveOp<T extends AnchorRegionOp | SlotRegionOp>(
  kind: CompileRegionKind,
  table: Record<CompileRegionKind, T>,
  domain: "template" | "slot",
  fallback?: RegionOpFallback
): T {
  const op = table[kind]
  if (op !== undefined) return op
  const policy = fallback ?? (__DEV__ ? "throw" : PROD_FALLBACK)
  if (policy === "throw") {
    throw new KiruError({
      message: `[kiru]: no ${domain} region op for kind "${kind}"`,
    })
  }
  return table.insert
}

export function resolveAnchorRegionOp(
  kind: CompileRegionKind,
  fallback?: RegionOpFallback
): AnchorRegionOp {
  return resolveOp(kind, anchorRegionOps, "template", fallback)
}

export function resolveSlotRegionOp(
  kind: CompileRegionKind,
  fallback?: RegionOpFallback
): SlotRegionOp {
  return resolveOp(kind, slotRegionOps, "slot", fallback)
}

export function runAnchorRegionOp(
  region: CompileRegion,
  ctx: AnchorRegionCtx
): Kiru.VNode | null {
  return resolveAnchorRegionOp(region.kind)(ctx)
}

/** `null` means the caller should fall back to full dynamic child reconciliation. */
export function runSlotRegionOp(
  region: CompileRegion,
  ctx: SlotRegionCtx
): Kiru.VNode | null {
  const result = resolveSlotRegionOp(region.kind)(ctx)
  if (result === "fallback") return null
  return result
}
