/**
 * Server / build-time ISR metadata readers (`readRouteISRExport`).
 *
 * @see docs/router/tier-3-wave-1.md
 */

import { warnOnce } from "./devWarnings.js"
import type { RouteRevalidate } from "./isr.js"

export type { ForceDynamicISRConfig, HybridISRConfig, ISRConfig, KiruISRConfig, RouteRevalidate } from "./isr.js"
export { defineISR, isKiruISRConfig } from "./isr.js"

/** Controls hybrid disk serve vs SSR at request time. */
export type RouteDynamicMode = "force-static" | "force-dynamic"

/**
 * Normalized ISR metadata after reading a page module (invalid combinations stripped).
 */
export type ResolvedISRConfig =
  | { dynamic: "force-dynamic"; revalidate?: never; tags?: never }
  | { dynamic?: "force-static"; revalidate?: RouteRevalidate; tags?: string[] }

export function isForceDynamicISR(
  config: ResolvedISRConfig
): config is { dynamic: "force-dynamic" } {
  return config.dynamic === "force-dynamic"
}

export function getISRRevalidate(
  config: ResolvedISRConfig | undefined
): RouteRevalidate | undefined {
  if (!config || isForceDynamicISR(config)) return undefined
  return config.revalidate
}

export function getISRTags(
  config: ResolvedISRConfig | undefined
): string[] | undefined {
  if (!config || isForceDynamicISR(config)) return undefined
  return config.tags
}

function normalizeTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const tags = raw.filter((x): x is string => typeof x === "string" && x.length > 0)
  return tags.length > 0 ? tags : undefined
}

function normalizeRevalidate(raw: unknown): RouteRevalidate | undefined {
  if (raw === false) return false
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw
  return undefined
}

function warnIgnoredISRFields(
  dynamic: "force-dynamic",
  ignored: { revalidate?: unknown; tags?: unknown }
): void {
  const parts: string[] = []
  if (ignored.revalidate !== undefined) parts.push("`revalidate`")
  if (ignored.tags !== undefined) parts.push("`tags`")
  if (parts.length === 0) return
  warnOnce(
    "isr-force-dynamic-ignored",
    `export const isr with dynamic: "${dynamic}" ignores ${parts.join(" and ")}; use hybrid ISR (omit dynamic) for prerender cache and on-demand revalidation.`
  )
}

function normalizeISRConfig(raw: unknown): ResolvedISRConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const o = raw as Record<string, unknown>
  const dynamic =
    o.dynamic === "force-static" || o.dynamic === "force-dynamic"
      ? o.dynamic
      : undefined
  const revalidate = normalizeRevalidate(o.revalidate)
  const tags = normalizeTags(o.tags)

  if (dynamic === "force-dynamic") {
    warnIgnoredISRFields("force-dynamic", {
      revalidate: o.revalidate,
      tags: o.tags,
    })
    return { dynamic: "force-dynamic" }
  }

  if (
    revalidate === undefined &&
    dynamic === undefined &&
    tags === undefined
  ) {
    return undefined
  }

  return {
    ...(dynamic !== undefined ? { dynamic } : {}),
    ...(revalidate !== undefined ? { revalidate } : {}),
    ...(tags !== undefined ? { tags } : {}),
  }
}

/**
 * Read `export const isr` from a page module (supports legacy `revalidate` / `tags` / `dynamic` exports).
 */
export function readRouteISRExport(mod: unknown): ResolvedISRConfig | undefined {
  if (!mod || typeof mod !== "object") return undefined
  const record = mod as Record<string, unknown>

  if (record.isr !== undefined) {
    const fromIsr = normalizeISRConfig(record.isr)
    if (fromIsr) return fromIsr
  }

  const revalidate = normalizeRevalidate(record.revalidate)
  const dynamic =
    record.dynamic === "force-static" || record.dynamic === "force-dynamic"
      ? record.dynamic
      : undefined
  const tags = normalizeTags(record.tags)

  if (dynamic === "force-dynamic") {
    warnIgnoredISRFields("force-dynamic", {
      revalidate: record.revalidate,
      tags: record.tags,
    })
    return { dynamic: "force-dynamic" }
  }

  if (
    revalidate === undefined &&
    dynamic === undefined &&
    tags === undefined
  ) {
    return undefined
  }

  return {
    ...(dynamic !== undefined ? { dynamic } : {}),
    ...(revalidate !== undefined ? { revalidate } : {}),
    ...(tags !== undefined ? { tags } : {}),
  }
}

export function getRouteBuildMetaFromModule(
  mod: unknown
): ResolvedISRConfig | undefined {
  return readRouteISRExport(mod)
}
