export type KiruQueryPatch =
  | { queryId: string; input: unknown; op: "refresh"; data: unknown }
  | { queryId: string; input: unknown; op: "set"; data: unknown }

export const KIRU_QUERY_PATCHES_KEY = "__kiruQueryPatches" as const

let activePatchCollector: KiruQueryPatch[] | undefined

export function beginQueryPatchCollector(): void {
  activePatchCollector = []
}

export function endQueryPatchCollector(): KiruQueryPatch[] {
  const patches = activePatchCollector ?? []
  activePatchCollector = undefined
  return patches
}

export function getActiveQueryPatchCollector(): KiruQueryPatch[] | undefined {
  return activePatchCollector
}

export function queueQueryPatch(patch: KiruQueryPatch): void {
  activePatchCollector?.push(patch)
}
