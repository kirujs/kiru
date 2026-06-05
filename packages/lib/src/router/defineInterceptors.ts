import { signal } from "../signals/base.js"
import { getActiveRouter } from "./routerGlobal.js"
import { useInterceptorOwner, useInterceptorPlacement } from "./interceptorOwner.js"
import {
  bindRouteInterceptorInSetup,
  buildInterceptorRuntimeDeps,
  type RouteInterceptorSignals,
} from "./routeInterceptors.js"
import { getRouterInstanceRuntime, tryGetRouterInstanceRuntime } from "./routerRuntime.js"
import type {
  InterceptLoadContext,
  InterceptRenderContext,
  InterceptorHandle,
  NavigatePath,
} from "./routePaths.js"
export type InterceptorSlotDefinition<
  P extends NavigatePath = NavigatePath,
  Data = unknown,
> = {
  path: P
  load?: (
    ctx: InterceptLoadContext<import("./routePaths.js").RouteParams<P>>
  ) => Data | Promise<Data>
  render: {
    bivariance(
      ctx: InterceptRenderContext<
        import("./routePaths.js").RouteParams<P>,
        Data
      >
    ): JSX.Element
  }["bivariance"]
}

export function defineInterceptors<
  const T extends Record<string, InterceptorSlotDefinition>,
>(definitions: T): { [K in keyof T]: InterceptorHandle } {
  const result = {} as { [K in keyof T]: InterceptorHandle }
  for (const name of Object.keys(definitions) as (keyof T)[]) {
    result[name] = createDefinedInterceptorHandle(
      String(name),
      definitions[name]! as InterceptorSlotDefinition<string, unknown>
    )
  }
  return result
}

function createDefinedInterceptorHandle(
  slot: string,
  def: InterceptorSlotDefinition<string, unknown>
): InterceptorHandle {
  const isActive = signal(false)
  const isPending = signal(false)
  const signals: RouteInterceptorSignals = { isActive, isPending }
  let restoreImpl: () => void = () => {}

  const Outlet: Kiru.Component = () => {
    const router = getActiveRouter()
    if (!router) return null
    const runtime = tryGetRouterInstanceRuntime(router)
    if (!runtime?.registerRouteInterceptor) return null

    const owner = useInterceptorOwner()
    if (!owner) {
      throw new Error(
        `[kiru] defineInterceptors Outlet for slot "${slot}" requires InterceptorOwnerProvider (co-export interceptors on a page or layout module)`
      )
    }

    const placement = useInterceptorPlacement()
    if (placement) {
      placement.markPlaced(slot)
    }

    const deps = buildInterceptorRuntimeDeps(router, getRouterInstanceRuntime(router))
    const handle = bindRouteInterceptorInSetup(
      deps,
      def.path,
      { load: def.load, render: def.render },
      signals,
      owner
    )
    restoreImpl = handle.restore
    return handle.Outlet({})
  }

  return {
    Outlet,
    isActive,
    isPending,
    restore: () => restoreImpl(),
    slot,
    path: def.path,
  }
}
