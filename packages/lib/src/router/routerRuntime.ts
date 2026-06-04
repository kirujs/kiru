import { __DEV__ } from "../env.js"
import type { InternationalizationConfig } from "./i18n/createI18nConfig.js"
import type { InterceptorRegistration } from "./routeInterceptors.js"
import type {
  InterceptorHandle,
  InterceptorOptions,
  NavigatePath,
} from "./routePaths.js"
import type { RouteMatch } from "./types.js"
import type {
  NavigationFailure,
  NavigationGuard,
  RouteLocation,
} from "./types.js"
import type { createI18nRuntime, I18nContextValue } from "./i18nContext.js"
import type { Router } from "./routerInstance.js"
import { getActiveRouter } from "./routerGlobal.js"

export type RouterI18nRuntime = {
  config: InternationalizationConfig<readonly string[], unknown>
  runtime: ReturnType<typeof createI18nRuntime<unknown>>
  value: () => I18nContextValue
}

export type RouterRuntime = {
  getNavGeneration: () => number
  getNavSignal: () => AbortSignal
  i18n?: RouterI18nRuntime
  registerComponentGuard: (
    kind: "leave" | "update" | "enter",
    guard: NavigationGuard,
    routeId?: string
  ) => () => void
  getLastNavigation: () =>
    | {
        to: RouteLocation
        from: RouteLocation | null
        failure?: NavigationFailure
      }
    | undefined
  setLastNavigation: (
    entry:
      | {
          to: RouteLocation
          from: RouteLocation | null
          failure?: NavigationFailure
        }
      | undefined
  ) => void
  registerRouteInterceptor?: <P extends NavigatePath>(
    target: P,
    options: InterceptorOptions<P>,
    fromRouteId?: string,
    signals?: import("./routeInterceptors.js").RouteInterceptorSignals
  ) => InterceptorHandle
  getRouteInterceptorRegistrations?: () => readonly InterceptorRegistration[]
  buildTargetLocation?: (
    match: RouteMatch
  ) => import("./types.js").RouteLocation
  dismissRouteIntercept?: (options?: { skipHistoryBack?: boolean }) => void
}

const ROUTER_RUNTIME = Symbol.for("kiru.router.runtime")

type RouterWithRuntime = Router & {
  [ROUTER_RUNTIME]?: RouterRuntime
}

export function setRouterInstanceRuntime(
  router: Router,
  runtime: RouterRuntime
): void {
  const target = router as RouterWithRuntime
  if (target[ROUTER_RUNTIME]) {
    throw new Error(
      "[kiru] Router runtime is already initialized on this router"
    )
  }
  target[ROUTER_RUNTIME] = runtime
}

export function getRouterInstanceRuntime(router: Router): RouterRuntime {
  if (__DEV__) {
    const active = getActiveRouter()
    if (active && active !== router) {
      throw new Error(
        "[kiru] getRouterInstanceRuntime called with a router that is not the active page router"
      )
    }
  }
  const runtime = (router as RouterWithRuntime)[ROUTER_RUNTIME]
  if (!runtime) {
    throw new Error("[kiru] Router runtime is not initialized")
  }
  return runtime
}

export function tryGetRouterInstanceRuntime(
  router: Router
): RouterRuntime | undefined {
  return (router as RouterWithRuntime)[ROUTER_RUNTIME]
}

export function getActiveRouterRuntime(): RouterRuntime {
  const router = getActiveRouter()
  if (!router) {
    throw new Error("[kiru] No active router on this page")
  }
  return getRouterInstanceRuntime(router)
}
