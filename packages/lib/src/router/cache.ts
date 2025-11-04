import type { PageDataLoaderCacheConfig, RouteParams } from "./types.js"

export interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
  ttl: number
}

export interface CacheKey {
  path: string
  params: RouteParams
  query: Record<string, string | string[] | undefined>
}

/**
 * Abstract base class for router cache implementations
 */
abstract class BaseCacheStore {
  protected abstract getItem(key: string): CacheEntry | null
  protected abstract setItem(key: string, entry: CacheEntry): void
  public abstract removeItem(key: string): void
  public abstract getAllKeys(): string[]
  public abstract clear(): void

  /**
   * Generate a cache key from route information
   */
  protected generateKey(key: CacheKey): string {
    const { path, params, query } = key
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&")

    const sortedQuery = Object.keys(query)
      .sort()
      .map((k) => {
        const value = query[k]
        if (Array.isArray(value)) {
          return `${k}=${value.sort().join(",")}`
        }
        return `${k}=${value}`
      })
      .join("&")

    return `kiru-cache:${path}?${sortedParams}&${sortedQuery}`
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: CacheKey): null | { value: T } {
    const cacheKey = this.generateKey(key)
    const entry = this.getItem(cacheKey)

    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.removeItem(cacheKey)
      return null
    }

    return { value: entry.data as T }
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: CacheKey, data: T, ttl: number): void {
    const cacheKey = this.generateKey(key)
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }
    this.setItem(cacheKey, entry)
  }

  /**
   * Get cache size for debugging
   */
  size(): number {
    return this.getAllKeys().length
  }
}

/**
 * In-memory cache implementation
 */
class MemoryCacheStore extends BaseCacheStore {
  private cache = new Map<string, CacheEntry>()

  protected getItem(key: string): CacheEntry | null {
    return this.cache.get(key) || null
  }

  protected setItem(key: string, entry: CacheEntry): void {
    this.cache.set(key, entry)
  }

  public removeItem(key: string): void {
    this.cache.delete(key)
  }

  public getAllKeys(): string[] {
    return Array.from(this.cache.keys())
  }

  public clear(): void {
    this.cache.clear()
  }
}

/**
 * (local|session)Storage cache implementation
 */
class StorageCacheStore extends BaseCacheStore {
  private keyPrefix = "kiru-cache:"
  constructor(private storage: Storage) {
    super()
  }

  protected getItem(key: string): CacheEntry | null {
    try {
      const item = this.storage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch {
      // Handle JSON parse errors or storage unavailable
      return null
    }
  }

  protected setItem(key: string, entry: CacheEntry): void {
    try {
      this.storage.setItem(key, JSON.stringify(entry))
    } catch {
      // Handle storage quota exceeded or unavailable
      // Silently fail - cache is not critical
    }
  }

  public removeItem(key: string): void {
    try {
      this.storage.removeItem(key)
    } catch {
      // Silently handle errors
    }
  }

  public getAllKeys(): string[] {
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = this.storage.key(i)
        if (key && key.startsWith(this.keyPrefix)) {
          keys.push(key)
        }
      }
      return keys
    } catch {
      return []
    }
  }

  public clear(): void {
    try {
      const keysToRemove = this.getAllKeys()
      keysToRemove.forEach((key) => this.storage.removeItem(key))
    } catch {
      // Silently handle errors
    }
  }
}

/**
 * Main router cache that manages different storage types
 */
export class RouterCache {
  private stores = new Map<string, BaseCacheStore>()

  constructor() {
    // Initialize default stores
    this.stores.set("memory", new MemoryCacheStore())
    this.stores.set("localStorage", new StorageCacheStore(localStorage))
    this.stores.set("sessionStorage", new StorageCacheStore(sessionStorage))
  }

  /**
   * Get the appropriate cache store for the given config
   */
  private getStore(config: PageDataLoaderCacheConfig): BaseCacheStore {
    const store = this.stores.get(config.type)
    if (!store) {
      // Fallback to memory cache if type is not supported
      return this.stores.get("memory")!
    }
    return store
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(
    key: CacheKey,
    config: PageDataLoaderCacheConfig
  ): null | { value: T } {
    const store = this.getStore(config)
    return store.get<T>(key)
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: CacheKey, data: T, config: PageDataLoaderCacheConfig): void {
    const store = this.getStore(config)
    store.set(key, data, config.ttl)
  }

  /**
   * Invalidate cache entries by path patterns across all storage types
   * Supports both exact paths ("/users/1") and folder patterns ("/users/[id]")
   */
  invalidate(...paths: string[]): void {
    // Invalidate across all storage types
    for (const store of this.stores.values()) {
      this.invalidateInStore(store, paths)
    }
  }

  /**
   * Invalidate cache entries in a specific store
   */
  private invalidateInStore(store: BaseCacheStore, paths: string[]): void {
    const keysToDelete: string[] = []

    for (const path of paths) {
      if (this.isPattern(path)) {
        // Folder path pattern - check all cache keys
        for (const cacheKey of store.getAllKeys()) {
          const keyPath = this.extractPathFromCacheKey(cacheKey)
          if (keyPath && this.pathMatchesPattern(keyPath, [path])) {
            keysToDelete.push(cacheKey)
          }
        }
      } else {
        // Exact path - find all cache keys that match this path
        for (const cacheKey of store.getAllKeys()) {
          const keyPath = this.extractPathFromCacheKey(cacheKey)
          if (keyPath === path) {
            keysToDelete.push(cacheKey)
          }
        }
      }
    }

    // Delete all matched keys
    for (const key of keysToDelete) {
      store.removeItem(key)
    }
  }

  /**
   * Extract the path part from a cache key
   */
  private extractPathFromCacheKey(cacheKey: string): string | null {
    // Remove the prefix and extract path part
    const withoutPrefix = cacheKey.replace(/^kiru-cache:/, "")
    const pathPart = withoutPrefix.split("?")[0]
    return pathPart || null
  }

  /**
   * Check if a pattern string contains dynamic segments
   */
  private isPattern(path: string): boolean {
    return path.includes("[") && path.includes("]")
  }

  /**
   * Check if a given path matches any of the invalidation patterns
   */
  pathMatchesPattern(currentPath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (this.isPattern(pattern)) {
        // Convert pattern to segments and match
        if (this.matchPathPattern(currentPath, pattern)) {
          return true
        }
      } else {
        // Exact path match
        if (currentPath === pattern) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Match a path against a pattern using segment-by-segment comparison
   * This is more reliable than regex for our use case
   */
  private matchPathPattern(path: string, pattern: string): boolean {
    const pathSegments = path.split("/").filter(Boolean)
    const patternSegments = pattern.split("/").filter(Boolean)

    // Handle catchall patterns
    const hasCatchall = patternSegments.some(
      (seg) => seg.startsWith("[...") && seg.endsWith("]")
    )

    if (hasCatchall) {
      // Find the catchall position
      const catchallIndex = patternSegments.findIndex(
        (seg) => seg.startsWith("[...") && seg.endsWith("]")
      )

      // Check segments before catchall
      for (let i = 0; i < catchallIndex; i++) {
        if (!this.segmentMatches(pathSegments[i], patternSegments[i])) {
          return false
        }
      }

      // Catchall matches remaining segments
      return pathSegments.length >= catchallIndex
    } else {
      // Regular pattern - must have same number of segments
      if (pathSegments.length !== patternSegments.length) {
        return false
      }

      // Check each segment
      for (let i = 0; i < pathSegments.length; i++) {
        if (!this.segmentMatches(pathSegments[i], patternSegments[i])) {
          return false
        }
      }

      return true
    }
  }

  /**
   * Check if a path segment matches a pattern segment
   */
  private segmentMatches(pathSegment: string, patternSegment: string): boolean {
    // Dynamic segment [param] matches any value
    if (
      patternSegment.startsWith("[") &&
      patternSegment.endsWith("]") &&
      !patternSegment.startsWith("[...")
    ) {
      return pathSegment !== undefined
    }

    // Catchall segment [...param] matches any remaining segments
    if (patternSegment.startsWith("[...") && patternSegment.endsWith("]")) {
      return true
    }

    // Static segment must match exactly
    return pathSegment === patternSegment
  }

  /**
   * Clear all cached data across all storage types
   */
  clear(): void {
    for (const store of this.stores.values()) {
      store.clear()
    }
  }

  /**
   * Get cache size for debugging (memory cache only)
   */
  size(): number {
    const memoryStore = this.stores.get("memory")
    return memoryStore ? memoryStore.size() : 0
  }
}
