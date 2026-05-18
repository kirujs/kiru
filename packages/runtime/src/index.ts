/**
 * Deploy target contract shared by Kiru adapters and vite-plugin-kiru.
 *
 * @see docs/router/deploy-runtimes.md
 */

export type KiruDeployTarget = "node" | "bun" | "cloudflare"

export type RuntimeCapabilities = {
  /** Time-based ISR, SWR regen, revalidatePath / revalidateTag */
  isr: boolean
  /** Writable prerender cache (disk or shared store) */
  mutablePrerenderCache: boolean
  /** sharp / local disk runtime image optimizer */
  runtimeImageOptimizer: boolean
  /** Node-style filesystem helpers (resolveStatic, disk cache) */
  fs: boolean
}

export type ISRExportLike = {
  dynamic?: "force-static" | "force-dynamic"
  revalidate?: number | false
  tags?: string[]
}

export function getRuntimeCapabilities(
  target: KiruDeployTarget
): RuntimeCapabilities {
  switch (target) {
    case "node":
    case "bun":
      return {
        isr: true,
        mutablePrerenderCache: true,
        runtimeImageOptimizer: true,
        fs: true,
      }
    case "cloudflare":
      return {
        isr: false,
        mutablePrerenderCache: false,
        runtimeImageOptimizer: false,
        fs: false,
      }
    default: {
      const _exhaustive: never = target
      return _exhaustive
    }
  }
}

export type AssertISRAllowedOptions = {
  /** Route id or file path for error messages */
  routeId?: string
}

/**
 * Throws when ISR features incompatible with the deploy target are used.
 * Used at build time (vite-plugin) and adapter startup.
 */
export function assertISRAllowed(
  target: KiruDeployTarget,
  isr: ISRExportLike | undefined,
  options: AssertISRAllowedOptions = {}
): void {
  if (!isr || isr.dynamic === "force-dynamic") return
  const caps = getRuntimeCapabilities(target)
  if (caps.isr) return

  const route = options.routeId ? ` (${options.routeId})` : ""
  const hasTimedRevalidate =
    typeof isr.revalidate === "number" && isr.revalidate > 0
  const hasTags = Array.isArray(isr.tags) && isr.tags.length > 0

  if (hasTimedRevalidate || hasTags) {
    throw new Error(
      `[kiru] ISR with time-based revalidate or cache tags is not supported on deploy target "${target}"${route}. ` +
        `Use revalidate: false for immutable prerender, or dynamic: "force-dynamic" for SSR-only. ` +
        `See docs/router/deploy-runtimes.md`
    )
  }
}

/**
 * Returns human-readable warnings for ISR config on edge (non-throwing).
 */
export function getISRWarningsForTarget(
  target: KiruDeployTarget,
  isr: ISRExportLike | undefined,
  routeId?: string
): string[] {
  if (!isr || getRuntimeCapabilities(target).isr) return []
  const warnings: string[] = []
  const prefix = routeId ? `[${routeId}] ` : ""
  if (typeof isr.revalidate === "number" && isr.revalidate > 0) {
    warnings.push(
      `${prefix}revalidate: ${isr.revalidate} is ignored on "${target}" — use force-dynamic or immutable prerender only`
    )
  }
  if (Array.isArray(isr.tags) && isr.tags.length > 0) {
    warnings.push(
      `${prefix}tags are ignored on "${target}" — on-demand revalidation requires a Node-class runtime`
    )
  }
  return warnings
}

export function isEdgeDeployTarget(
  target: KiruDeployTarget | undefined
): target is "cloudflare" {
  return target === "cloudflare"
}

/**
 * Vite client output paths that should not hit SSR (hashed bundles, images, etc.).
 * Excludes `.html` so `/` and app routes are rendered, not the shell `index.html`.
 */
export function isStaticAssetPathname(pathname: string): boolean {
  if (pathname.startsWith("/assets/")) return true
  const last = pathname.split("/").pop() ?? ""
  const dot = last.lastIndexOf(".")
  if (dot <= 0) return false
  const ext = last.slice(dot + 1).toLowerCase()
  if (ext === "html") return false
  return true
}
