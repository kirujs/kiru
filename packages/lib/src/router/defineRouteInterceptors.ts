import { signal } from "../signals/base.js"
import { getActiveRouter } from "./routerGlobal.js"
import {
  bindRouteInterceptorInSetup,
  buildInterceptorRuntimeDeps,
  type RouteInterceptorSignals,
} from "./routeInterceptors.js"
import { getRouterInstanceRuntime } from "./routerRuntime.js"
import type {
  InterceptorHandle,
  NavigatePath,
  RouteInterceptorDefinition,
} from "./routePaths.js"

/**
 * Declare one interceptor with inferred path params and load data.
 * Use inside {@link defineRouteInterceptors}.
 */
export function routeInterceptor<const P extends NavigatePath, Data>(
  path: P,
  definition: Omit<RouteInterceptorDefinition<P, Data>, "path">
): RouteInterceptorDefinition<P, Data> {
  return { path, ...definition }
}

export function defineRouteInterceptors<
  const T extends Record<string, RouteInterceptorDefinition>,
>(definitions: T): { [K in keyof T]: InterceptorHandle } {
  const result = {} as { [K in keyof T]: InterceptorHandle }
  for (const name of Object.keys(definitions) as (keyof T)[]) {
    result[name] = createDefinedInterceptorHandle(
      definitions[name]! as unknown as RouteInterceptorDefinition<string, unknown>
    )
  }
  return result
}

function createDefinedInterceptorHandle(
  def: RouteInterceptorDefinition<string, unknown>
): InterceptorHandle {
  const isActive = signal(false)
  const isPending = signal(false)
  const signals: RouteInterceptorSignals = { isActive, isPending }
  let restoreImpl: () => void = () => {}

  const Outlet: Kiru.Component = () => {
    const router = getActiveRouter()
    if (!router) {
      throw new Error(
        "[kiru] defineRouteInterceptors Outlet requires an active RouterProvider"
      )
    }
    const runtime = getRouterInstanceRuntime(router)
    if (!runtime.registerRouteInterceptor) {
      throw new Error(
        "[kiru] defineRouteInterceptors requires createRouter (client history mode)"
      )
    }
    const deps = buildInterceptorRuntimeDeps(router, runtime)
    const handle = bindRouteInterceptorInSetup(
      deps,
      def.path,
      { load: def.load, render: def.render, from: def.from },
      signals
    )
    restoreImpl = handle.restore
    return handle.Outlet({})
  }

  return {
    Outlet,
    isActive,
    isPending,
    restore: () => restoreImpl(),
  }
}
