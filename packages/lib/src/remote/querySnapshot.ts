import type { KiruQuerySnapshot } from "./queryCache.js"

export const KIRU_QUERIES_KEY = "__kiruQueries" as const

let activeSnapshots: KiruQuerySnapshot[] | undefined

export function beginQuerySnapshotCollector(): void {
  activeSnapshots = []
}

export function endQuerySnapshotCollector(): KiruQuerySnapshot[] {
  const snapshots = activeSnapshots ?? []
  activeSnapshots = undefined
  return snapshots
}

export function getActiveQuerySnapshotCollector(): KiruQuerySnapshot[] | undefined {
  return activeSnapshots
}

export function recordQuerySnapshot(
  queryId: string,
  input: unknown,
  data: unknown
): void {
  if (!activeSnapshots) return
  activeSnapshots.push({
    queryId,
    input: input === undefined ? null : input,
    data,
  })
}
