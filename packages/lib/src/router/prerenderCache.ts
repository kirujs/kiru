/**
 * Prerendered HTML cache with TTL and tag index (disk + in-memory).
 *
 * @see docs/router/tier-3-wave-1.md#hybrid-isr
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { RouteRevalidate } from "./routeRevalidate.js"
import { tryReadPrerenderedHtml } from "./prerenderedHtml.js"
import type { RouterPathPolicy } from "./pathPolicy.js"

export type PrerenderCacheEntry = {
  html: string
  generatedAt: number
  revalidate: RouteRevalidate
  tags: string[]
  pathname: string
}

export interface PrerenderCacheStore {
  get(pathname: string): PrerenderCacheEntry | null
  set(pathname: string, entry: PrerenderCacheEntry): Promise<void>
  delete(path: string | string[]): Promise<void>
  deleteByTag(tag: string | string[]): Promise<void>
}

export function isPrerenderEntryFresh(entry: PrerenderCacheEntry): boolean {
  if (entry.revalidate === false) return true
  if (typeof entry.revalidate !== "number" || entry.revalidate <= 0) return true
  const ageSec = (Date.now() - entry.generatedAt) / 1000
  return ageSec < entry.revalidate
}

export function isPrerenderEntryStale(entry: PrerenderCacheEntry): boolean {
  if (entry.revalidate === false) return false
  if (typeof entry.revalidate !== "number" || entry.revalidate <= 0) return false
  return !isPrerenderEntryFresh(entry)
}

const META_SUFFIX = ".prerender-meta.json"

function metaPathForHtml(htmlPath: string): string {
  if (htmlPath.endsWith(".html")) {
    return htmlPath.replace(/\.html$/, META_SUFFIX)
  }
  return `${htmlPath}${META_SUFFIX}`
}

type DiskIndex = {
  byPath: Record<string, { htmlPath: string; metaPath: string }>
  byTag: Record<string, string[]>
}

function readDiskIndex(clientDir: string): DiskIndex {
  const indexPath = join(clientDir, ".kiru-prerender-index.json")
  if (!existsSync(indexPath)) {
    return { byPath: {}, byTag: {} }
  }
  try {
    return JSON.parse(readFileSync(indexPath, "utf8")) as DiskIndex
  } catch {
    return { byPath: {}, byTag: {} }
  }
}

function writeDiskIndex(clientDir: string, index: DiskIndex): void {
  const indexPath = join(clientDir, ".kiru-prerender-index.json")
  mkdirSync(clientDir, { recursive: true })
  writeFileSync(indexPath, JSON.stringify(index, null, 0), "utf8")
}

export type DiskPrerenderCacheOptions = {
  clientDir: string
  pathPolicy?: RouterPathPolicy
  staticPaths?: ReadonlySet<string>
}

/**
 * Disk-backed prerender cache using HTML files plus sidecar metadata.
 */
export function diskPrerenderCache(
  options: DiskPrerenderCacheOptions
): PrerenderCacheStore {
  const { clientDir, pathPolicy, staticPaths } = options

  const loadEntry = (pathname: string): PrerenderCacheEntry | null => {
    const html = tryReadPrerenderedHtml(clientDir, pathname, {
      pathPolicy,
      staticPaths,
    })
    if (!html) return null

    const index = readDiskIndex(clientDir)
    const paths = index.byPath[pathname]
    let meta: {
      generatedAt: number
      revalidate: RouteRevalidate
      tags: string[]
    } | null = null
    if (paths?.metaPath && existsSync(paths.metaPath)) {
      try {
        meta = JSON.parse(readFileSync(paths.metaPath, "utf8"))
      } catch {
        meta = null
      }
    }

    return {
      html,
      pathname,
      generatedAt: meta?.generatedAt ?? 0,
      revalidate: meta?.revalidate ?? false,
      tags: meta?.tags ?? [],
    }
  }

  return {
    get(pathname) {
      return loadEntry(pathname)
    },
    async set(pathname, entry) {
      const index = readDiskIndex(clientDir)
      const htmlPath =
        index.byPath[pathname]?.htmlPath ??
        join(clientDir, pathname.replace(/^\//, "") + ".html")
      mkdirSync(dirname(htmlPath), { recursive: true })
      writeFileSync(htmlPath, entry.html, "utf8")
      const metaPath = metaPathForHtml(htmlPath)
      writeFileSync(
        metaPath,
        JSON.stringify({
          generatedAt: entry.generatedAt,
          revalidate: entry.revalidate,
          tags: entry.tags,
        }),
        "utf8"
      )
      const tagIndex = { ...index.byTag }
      for (const tag of entry.tags) {
        const list = new Set(tagIndex[tag] ?? [])
        list.add(pathname)
        tagIndex[tag] = [...list]
      }
      index.byPath[pathname] = { htmlPath, metaPath }
      index.byTag = tagIndex
      writeDiskIndex(clientDir, index)
    },
    async delete(paths) {
      const list = Array.isArray(paths) ? paths : [paths]
      const index = readDiskIndex(clientDir)
      for (const pathname of list) {
        const p = index.byPath[pathname]
        if (p?.htmlPath && existsSync(p.htmlPath)) unlinkSync(p.htmlPath)
        if (p?.metaPath && existsSync(p.metaPath)) unlinkSync(p.metaPath)
        delete index.byPath[pathname]
        for (const tag of Object.keys(index.byTag)) {
          index.byTag[tag] = (index.byTag[tag] ?? []).filter((x) => x !== pathname)
        }
      }
      writeDiskIndex(clientDir, index)
    },
    async deleteByTag(tags) {
      const tagList = Array.isArray(tags) ? tags : [tags]
      const index = readDiskIndex(clientDir)
      const paths = new Set<string>()
      for (const tag of tagList) {
        for (const p of index.byTag[tag] ?? []) paths.add(p)
      }
      await this.delete([...paths])
    },
  }
}

/** In-memory store for tests and dev tooling. */
export function memoryPrerenderCache(
  initial?: Record<string, PrerenderCacheEntry>
): PrerenderCacheStore {
  const entries = new Map<string, PrerenderCacheEntry>(
    Object.entries(initial ?? {})
  )
  const tagIndex = new Map<string, Set<string>>()

  const reindexTags = (pathname: string, tags: string[]) => {
    for (const set of tagIndex.values()) set.delete(pathname)
    for (const tag of tags) {
      let set = tagIndex.get(tag)
      if (!set) {
        set = new Set()
        tagIndex.set(tag, set)
      }
      set.add(pathname)
    }
  }

  for (const [pathname, entry] of entries) {
    reindexTags(pathname, entry.tags)
  }

  return {
    get(pathname) {
      return entries.get(pathname) ?? null
    },
    async set(pathname, entry) {
      entries.set(pathname, entry)
      reindexTags(pathname, entry.tags)
    },
    async delete(paths) {
      const list = Array.isArray(paths) ? paths : [paths]
      for (const pathname of list) {
        const entry = entries.get(pathname)
        entries.delete(pathname)
        if (entry) reindexTags(pathname, [])
      }
    },
    async deleteByTag(tags) {
      const tagList = Array.isArray(tags) ? tags : [tags]
      const paths = new Set<string>()
      for (const tag of tagList) {
        for (const p of tagIndex.get(tag) ?? []) paths.add(p)
      }
      await this.delete([...paths])
    },
  }
}

export type PersistPrerenderBuildOutputOptions = {
  clientDir: string
  pathname: string
  htmlAbsolutePath: string
  revalidate?: RouteRevalidate
  tags?: string[]
  /** @default Date.now() */
  generatedAt?: number
}

/**
 * Register prerendered HTML from SSG with sidecar metadata (build time).
 * @see docs/router/tier-3-wave-1.md#hybrid-isr
 */
export function persistPrerenderBuildOutput(
  options: PersistPrerenderBuildOutputOptions
): void {
  const {
    clientDir,
    pathname,
    htmlAbsolutePath,
    revalidate = false,
    tags = [],
    generatedAt = Date.now(),
  } = options
  const metaPath = metaPathForHtml(htmlAbsolutePath)
  mkdirSync(dirname(metaPath), { recursive: true })
  writeFileSync(
    metaPath,
    JSON.stringify({ generatedAt, revalidate, tags }),
    "utf8"
  )
  const index = readDiskIndex(clientDir)
  const tagIndex = { ...index.byTag }
  for (const tag of tags) {
    const list = new Set(tagIndex[tag] ?? [])
    list.add(pathname)
    tagIndex[tag] = [...list]
  }
  index.byPath[pathname] = { htmlPath: htmlAbsolutePath, metaPath }
  index.byTag = tagIndex
  writeDiskIndex(clientDir, index)
}

/** Process-wide default store for `revalidatePath` / `revalidateTag`. */
let globalPrerenderCache: PrerenderCacheStore | null = null

export function setGlobalPrerenderCache(store: PrerenderCacheStore | null): void {
  globalPrerenderCache = store
}

export function getGlobalPrerenderCache(): PrerenderCacheStore | null {
  return globalPrerenderCache
}

const regenLocks = new Map<string, Promise<void>>()

export async function runPrerenderRegenSingleFlight(
  pathname: string,
  regen: () => Promise<void>
): Promise<void> {
  const existing = regenLocks.get(pathname)
  if (existing) return existing
  const job = regen().finally(() => {
    regenLocks.delete(pathname)
  })
  regenLocks.set(pathname, job)
  return job
}
