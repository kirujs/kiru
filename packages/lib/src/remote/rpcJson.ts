import { isKiruRedirect, type KiruRedirect } from "./kiruRedirect.js"
import { KIRU_QUERY_PATCHES_KEY, type KiruQueryPatch } from "./queryPatch.js"

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function readQueryPatches(
  value: unknown
): KiruQueryPatch[] | undefined {
  if (!isRecord(value) || !(KIRU_QUERY_PATCHES_KEY in value)) return undefined
  const patches = value[KIRU_QUERY_PATCHES_KEY]
  return Array.isArray(patches) ? (patches as KiruQueryPatch[]) : undefined
}

export function unwrapPatchedRpcBody(data: unknown): unknown {
  if (!isRecord(data) || !(KIRU_QUERY_PATCHES_KEY in data)) return data
  const { [KIRU_QUERY_PATCHES_KEY]: _patches, ...rest } = data
  const keys = Object.keys(rest)
  if (keys.length === 1 && "data" in rest) return rest.data
  if (keys.length === 0) return undefined
  return rest
}

export function readKiruRedirect(value: unknown): KiruRedirect | undefined {
  return isKiruRedirect(value) ? value : undefined
}
