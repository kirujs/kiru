/**
 * On-demand prerender invalidation (server-only).
 *
 * @see docs/router/tier-3-wave-1.md#on-demand-revalidation
 */

import type { RemoteRevalidateMeta } from "../remote/action.js"
import { getGlobalPrerenderCache } from "./prerenderCache.js"

function assertServerOnly(fn: string): void {
  if (typeof window !== "undefined") {
    throw new Error(`${fn} must only be called on the server`)
  }
}

/**
 * Invalidate prerendered HTML for `path` (normalized pathname, e.g. `/docs`).
 * @see docs/router/tier-3-wave-1.md#on-demand-revalidation
 */
export async function revalidatePath(
  path: string,
  _opts?: { type?: "page" | "layout" }
): Promise<void> {
  assertServerOnly("revalidatePath")
  const store = getGlobalPrerenderCache()
  if (!store) {
    throw new Error(
      "revalidatePath: no prerender cache configured (set via createRenderer prerenderCache or diskPrerenderCache)"
    )
  }
  const pathname = path.startsWith("/") ? path : `/${path}`
  await store.delete(pathname)
}

/**
 * Invalidate all prerendered paths tagged with `tag`.
 * @see docs/router/tier-3-wave-1.md#on-demand-revalidation
 */
/**
 * Run path/tag revalidation from action metadata (server-only).
 * @internal Called by the remote action handler after a successful invoke.
 */
export async function applyServerRevalidate(
  meta: RemoteRevalidateMeta | undefined
): Promise<void> {
  if (!meta) return
  assertServerOnly("applyServerRevalidate")
  if (meta.paths?.length) {
    for (const p of meta.paths) {
      await revalidatePath(p)
    }
  }
  if (meta.tags?.length) {
    await revalidateTag(meta.tags)
  }
}

export async function revalidateTag(tag: string | string[]): Promise<void> {
  assertServerOnly("revalidateTag")
  const store = getGlobalPrerenderCache()
  if (!store) {
    throw new Error(
      "revalidateTag: no prerender cache configured (set via createRenderer prerenderCache or diskPrerenderCache)"
    )
  }
  await store.deleteByTag(tag)
}
