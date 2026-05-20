import type { InternationalizationConfig } from "./i18n/createI18nConfig.js"
import type { ContextGateOptions } from "./routeMeta.js"
import type {
  NavigationFailure,
  NavigationGuard,
  RouteLocation,
} from "./types.js"
import type { createI18nRuntime, I18nContextValue } from "./i18nContext.js"
import type { Router } from "./csr.js"

export type RouterI18nRuntime = {
  config: InternationalizationConfig<readonly string[], unknown>
  runtime: ReturnType<typeof createI18nRuntime<unknown>>
  value: () => I18nContextValue
}

export type RouterRuntime = {
  gateOptions: ContextGateOptions
  getNavGeneration: () => number
  getNavSignal: () => AbortSignal
  i18n?: RouterI18nRuntime
  registerComponentGuard: (
    kind: "leave" | "update" | "enter",
    guard: NavigationGuard,
    routeId?: string
  ) => () => void
  getLastNavigation: () => {
    to: RouteLocation
    from: RouteLocation | null
    failure?: NavigationFailure
  } | undefined
  setLastNavigation: (
    entry:
      | {
          to: RouteLocation
          from: RouteLocation | null
          failure?: NavigationFailure
        }
      | undefined
  ) => void
}

const runtimeByRouter = new WeakMap<Router, RouterRuntime>()

export function attachRouterRuntime(router: Router, runtime: RouterRuntime): void {
  runtimeByRouter.set(router, runtime)
}

export function getRouterRuntime(router: Router): RouterRuntime {
  const runtime = runtimeByRouter.get(router)
  if (!runtime) {
    throw new Error("[kiru] Router runtime is not initialized")
  }
  return runtime
}

export function tryGetRouterRuntime(router: Router): RouterRuntime | undefined {
  return runtimeByRouter.get(router)
}
