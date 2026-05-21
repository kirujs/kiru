export type RouterBootstrapMode = "csr" | "ssg" | "ssr"

const BOOTSTRAP_MODE_KEY = "__kiru_routerBootstrap"

export function markRouterBootstrap(mode: RouterBootstrapMode): void {
  ;(globalThis as Record<string, unknown>)[BOOTSTRAP_MODE_KEY] = mode
}

export function getRouterBootstrapMode(): RouterBootstrapMode | undefined {
  return (globalThis as Record<string, unknown>)[
    BOOTSTRAP_MODE_KEY
  ] as RouterBootstrapMode | undefined
}
