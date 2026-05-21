import type { RouterBootstrapMode } from "./bootstrapMode.js"

declare const __KIRU_ROUTER_BOOTSTRAP__: RouterBootstrapMode | undefined

/** Compile-time mode from vite-plugin-kiru, else runtime `markRouterBootstrap`. */
export function effectiveRouterBootstrapMode(
  runtime: () => RouterBootstrapMode | undefined
): RouterBootstrapMode | undefined {
  if (typeof __KIRU_ROUTER_BOOTSTRAP__ !== "undefined") {
    return __KIRU_ROUTER_BOOTSTRAP__
  }
  return runtime()
}

export function isPureClientBootstrap(
  runtime: () => RouterBootstrapMode | undefined
): boolean {
  const mode = effectiveRouterBootstrapMode(runtime)
  return mode === "csr" || mode === "ssg"
}

export function isSsrBootstrap(
  runtime: () => RouterBootstrapMode | undefined
): boolean {
  return effectiveRouterBootstrapMode(runtime) === "ssr"
}
