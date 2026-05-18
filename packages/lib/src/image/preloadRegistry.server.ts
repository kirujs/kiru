import { AsyncLocalStorage } from "node:async_hooks"
import type { ImagePreloadLink } from "./types.js"
import { imagePreloadToHeadLink } from "./getImageProps.js"
import type { RouteHeadMeta } from "../router/types.js"

const preloadStore = new AsyncLocalStorage<ImagePreloadLink[]>()

/** Run SSR/SSG render with a per-request image preload collector. */
export function runWithImagePreloadRegistry<T>(fn: () => T): T {
  return preloadStore.run([], fn)
}

export function registerImagePreload(link: ImagePreloadLink): void {
  preloadStore.getStore()?.push(link)
}

export function peekImagePreloads(): readonly ImagePreloadLink[] {
  return preloadStore.getStore() ?? []
}

export function mergeImagePreloadsIntoHead(meta: RouteHeadMeta): RouteHeadMeta {
  const preloads = preloadStore.getStore()
  if (!preloads?.length) return meta
  const extra = preloads.map(imagePreloadToHeadLink)
  return {
    ...meta,
    links: [...(meta.links ?? []), ...extra],
  }
}
