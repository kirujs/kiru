import { assertISRAllowed, type ISRExportLike } from "@kirujs/runtime"
import type { SsgRouteBuildMeta, SsgRouteBuildMetaEntry } from "./ssgCacheTypes.js"

function entryToISR(entry: SsgRouteBuildMetaEntry): ISRExportLike | undefined {
  const hasRevalidate = entry.revalidate !== undefined
  const hasDynamic = entry.dynamic !== undefined
  const hasTags = Array.isArray(entry.tags) && entry.tags.length > 0
  if (!hasRevalidate && !hasDynamic && !hasTags) return undefined

  let revalidate: number | false | undefined
  if (entry.revalidate === false) revalidate = false
  else if (typeof entry.revalidate === "number") revalidate = entry.revalidate

  return {
    ...(entry.dynamic !== undefined ? { dynamic: entry.dynamic } : {}),
    ...(revalidate !== undefined ? { revalidate } : {}),
    ...(hasTags ? { tags: entry.tags } : {}),
  }
}

/** Fail the client build when route ISR meta is incompatible with Cloudflare. */
export function assertCloudflareRouteBuildMeta(buildMeta: SsgRouteBuildMeta): void {
  for (const [routeId, entry] of Object.entries(buildMeta.byRouteId)) {
    assertISRAllowed("cloudflare", entryToISR(entry), { routeId })
  }
}
