import type { ImagePreloadLink } from "./types.js"
import type { RouteHeadMeta } from "../router/types.js"

/** Browser no-op: preloads are SSR-only. */
export function runWithImagePreloadRegistry<T>(fn: () => T): T {
  return fn()
}

export function registerImagePreload(_link: ImagePreloadLink): void {}

export function peekImagePreloads(): readonly ImagePreloadLink[] {
  return []
}

export function mergeImagePreloadsIntoHead(meta: RouteHeadMeta): RouteHeadMeta {
  return meta
}
