/**
 * Page ISR export (`export const isr = defineISR(…)`).
 * Kept minimal so page modules can import from `kiru/router` in the client bundle.
 *
 * @see docs/router/tier-3-wave-1.md#hybrid-isr
 */

/** Seconds between regenerations; `false` = build-time immutable HTML only. */
export type RouteRevalidate = number | false

/**
 * Hybrid / static prerender cache: optional TTL, tags, and prerender-only mode.
 * Omit `dynamic` for default hybrid (prerender when fresh, else SSR).
 */
export type HybridISRConfig = {
  dynamic?: "force-static"
  revalidate?: RouteRevalidate
  tags?: string[]
}

/**
 * Always SSR; never read or write disk prerender for this route.
 * `revalidate` and `tags` are not used — set them only on hybrid routes.
 */
export type ForceDynamicISRConfig = {
  dynamic: "force-dynamic"
  revalidate?: never
  tags?: never
}

/** Argument to {@link defineISR}. */
export type ISRConfig = ForceDynamicISRConfig | HybridISRConfig

export type KiruISRConfig = ISRConfig & {
  readonly __kiruISR: true
}

/** Page export: `export const isr = defineISR({ revalidate: 60, tags: ['blog'] })`. */
export function defineISR(config: ISRConfig): KiruISRConfig {
  return { ...config, __kiruISR: true }
}

export function isKiruISRConfig(value: unknown): value is KiruISRConfig {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruISR" in value &&
    (value as KiruISRConfig).__kiruISR === true
  )
}
