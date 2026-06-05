import { __DEV__ } from "../env.js"
import { warnOnce } from "./devWarnings.dev.js"
import type { InterceptorHandle } from "./routePaths.js"
import type {
  CompiledRouteScope,
  LayoutLoader,
  PageLoader,
  RouteManifest,
} from "./types.js"

export type InterceptorManifestEntry = {
  ownerKind: "scope" | "route"
  ownerId: string
  moduleKey: string
  slots: string[]
  paths: string[]
}

export type InterceptorManifest = {
  entries: InterceptorManifestEntry[]
}

function readInterceptorsExport(
  mod: unknown
): Record<string, InterceptorHandle> | null {
  if (!mod || typeof mod !== "object") return null
  const interceptors = (mod as { interceptors?: Record<string, InterceptorHandle> })
    .interceptors
  if (!interceptors || typeof interceptors !== "object") return null
  return interceptors
}

function validateInterceptorPaths(
  manifest: RouteManifest,
  paths: string[],
  label: string
): void {
  for (const path of paths) {
    if (!manifest.routes.some((route) => route.path === path)) {
      throw new Error(
        `[kiru] defineInterceptors path "${path}" on ${label} does not match any route in the manifest`
      )
    }
  }
}

function collectEntry(
  manifest: RouteManifest,
  ownerKind: "scope" | "route",
  ownerId: string,
  moduleKey: string,
  handles: Record<string, InterceptorHandle>
): InterceptorManifestEntry | null {
  const slots = Object.keys(handles)
  if (slots.length === 0) return null
  const paths = slots.map((slot) => handles[slot]!.path)
  for (const slot of slots) {
    if (!handles[slot]?.path) {
      throw new Error(
        `[kiru] Interceptor slot "${slot}" on ${moduleKey} is missing path`
      )
    }
  }
  validateInterceptorPaths(manifest, paths, moduleKey)
  const pathSet = new Set(paths)
  if (pathSet.size !== paths.length && __DEV__) {
    warnOnce(
      `intercept-dup-path-${ownerId}`,
      `[kiru] Duplicate target path in interceptors on ${moduleKey}`
    )
  }
  return { ownerKind, ownerId, moduleKey, slots, paths }
}

export type DiscoverRouteInterceptorsOptions = {
  getModuleKey?: (ownerId: string, ownerKind: "scope" | "route") => string
}

/**
 * SSR-load route/layout modules and collect interceptor metadata for build validation.
 */
export async function discoverRouteInterceptors(
  manifest: RouteManifest,
  loadModule: (loader: LayoutLoader | PageLoader) => Promise<unknown>,
  opts?: DiscoverRouteInterceptorsOptions
): Promise<InterceptorManifest> {
  const moduleKey =
    opts?.getModuleKey ??
    ((ownerId: string) => ownerId)
  const entries: InterceptorManifestEntry[] = []
  const seenOwnerPath = new Set<string>()

  if (manifest.rootLayout) {
    const mod = await loadModule(manifest.rootLayout)
    const handles = readInterceptorsExport(mod)
    if (handles) {
      const ownerId = manifest.routes[0]?.scopes[0]?.id ?? "scope:0"
      const entry = collectEntry(
        manifest,
        "scope",
        ownerId,
        moduleKey(ownerId, "scope"),
        handles
      )
      if (entry) entries.push(entry)
    }
  }

  const scopeById = new Map<string, CompiledRouteScope>()
  for (const route of manifest.routes) {
    for (const scope of route.scopes) {
      scopeById.set(scope.id, scope)
    }
  }

  for (const [scopeId, scope] of scopeById) {
    if (!scope.layout || scope.layout === manifest.rootLayout) continue
    const mod = await loadModule(scope.layout)
    const handles = readInterceptorsExport(mod)
    if (!handles) continue
    const entry = collectEntry(
      manifest,
      "scope",
      scopeId,
      moduleKey(scopeId, "scope"),
      handles
    )
    if (entry) entries.push(entry)
  }

  for (const route of manifest.routes) {
    const mod = await route.component()
    const handles = readInterceptorsExport(mod)
    if (!handles) continue
    const entry = collectEntry(
      manifest,
      "route",
      route.id,
      moduleKey(route.id, "route"),
      handles
    )
    if (entry) entries.push(entry)
  }

  for (const entry of entries) {
    for (let i = 0; i < entry.paths.length; i++) {
      const path = entry.paths[i]!
      const key = `${entry.ownerId}:${path}`
      if (seenOwnerPath.has(key) && __DEV__) {
        warnOnce(
          `intercept-owner-dup-${key}`,
          `[kiru] Duplicate interceptor target "${path}" for owner ${entry.ownerId}`
        )
      }
      seenOwnerPath.add(key)
    }
  }

  return { entries }
}

export const INTERCEPTOR_MANIFEST_FILENAME = "kiru-interceptor-manifest.json"
