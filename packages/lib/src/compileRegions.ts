/** Compile-time region kinds for template holes and mixed `jsxs` layouts. */
export type CompileRegionKind =
  | "insert"
  | "fragment"
  | "conditional"
  | "text"
  | "children"
  | "component"

/** Metadata attached by vite-plugin-kiru (not a public authoring API). */
export interface CompileRegion {
  readonly kind: CompileRegionKind
  /** Index of `<!--#-->` in a template shell. */
  readonly anchor?: number
  /** Index in a static `jsxs` child array. */
  readonly slot?: number
}

export function regionTargetsSlot(
  region: CompileRegion
): region is CompileRegion & { slot: number } {
  return region.slot !== undefined
}

export function regionTargetsAnchor(
  region: CompileRegion
): region is CompileRegion & { anchor: number } {
  return region.anchor !== undefined
}

/** Slot indices that need full reconciliation on mixed static parents. */
export function dynamicSlotsFromRegions(
  regions: readonly CompileRegion[]
): readonly number[] {
  return regions
    .filter(regionTargetsSlot)
    .map((r) => r.slot)
}
