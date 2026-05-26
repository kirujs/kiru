import { __DEV__ } from "./env.js"
import { KiruError } from "./error.js"

/** Compile-time region kinds for template holes and mixed `jsxs` layouts. */
export type CompileRegionKind =
  | "insert"
  | "node"
  | "fragment"
  | "conditional"
  | "text"
  | "children"
  | "component"

/** Ownership domain: who binds the region (not a different data shape). */
export type RegionDomain = "template" | "slot"

/** Metadata attached by vite-plugin-kiru (not a public authoring API). */
export interface CompileRegion {
  readonly kind: CompileRegionKind
  /** Index of `<!--#-->` in a template shell. */
  readonly anchor?: number
  /** Stable child index in a compiler-built static child array. */
  readonly slot?: number
}

const ALL_KINDS: readonly CompileRegionKind[] = [
  "insert",
  "node",
  "fragment",
  "conditional",
  "text",
  "children",
  "component",
]

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

export function slotRegionAt(
  regions: readonly CompileRegion[] | undefined,
  slot: number
): CompileRegion | undefined {
  return regions?.find((r) => r.slot === slot)
}

export function validateRegions(
  regions: readonly CompileRegion[],
  domain: RegionDomain
): void {
  if (!__DEV__) return
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i]!
    if (!ALL_KINDS.includes(r.kind)) {
      throw new KiruError({
        message: `[kiru]: unknown compile region kind at index ${i}`,
      })
    }
    if (domain === "template") {
      if (r.slot !== undefined) {
        throw new KiruError({
          message: `[kiru]: template region at index ${i} must use anchor, not slot`,
        })
      }
      if (r.anchor === undefined) {
        throw new KiruError({
          message: `[kiru]: template region at index ${i} missing anchor`,
        })
      }
    } else {
      if (r.anchor !== undefined) {
        throw new KiruError({
          message: `[kiru]: slot region at index ${i} must use slot, not anchor`,
        })
      }
      if (r.slot === undefined) {
        throw new KiruError({
          message: `[kiru]: slot region at index ${i} missing slot`,
        })
      }
    }
  }
}

export function regionAt(
  regions: readonly CompileRegion[] | undefined,
  index: number,
  domain: RegionDomain
): CompileRegion {
  if (domain === "template") {
    const found = regions?.find((r) => r.anchor === index)
    return found ?? { kind: "insert", anchor: index }
  }
  const found = regions?.find((r) => r.slot === index)
  return found ?? { kind: "insert", slot: index }
}
