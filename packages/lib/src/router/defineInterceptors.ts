import { signal } from "../signals/base.js"
import { useRouter } from "./routerContext.js"
import { useInterceptorOwner } from "./interceptorOwner.js"
import {
  bindRouteInterceptorInSetup,
  buildInterceptorRuntimeDeps,
  type RouteInterceptorSignals,
} from "./routeInterceptors.js"
import { getRouterInstanceRuntime } from "./routerRuntime.js"
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

  const bindOptions = {
    load: def.load,
    render: def.render as InterceptorSlotDefinition<string, unknown>["render"],
  }

  const Outlet: Kiru.Component = () => {
    const router = useRouter()
    const runtime = getRouterInstanceRuntime(router)
    if (!runtime.registerRouteInterceptor) return null

    const owner = useInterceptorOwner()
    if (!owner) {
      throw new Error(
        `[kiru] defineInterceptors Outlet for slot "${slot}" requires InterceptorOwnerProvider (co-export interceptors on a page or layout module)`
      )
    }

    const deps = buildInterceptorRuntimeDeps(router, getRouterInstanceRuntime(router))
    const handle = bindRouteInterceptorInSetup(
      deps,
      def.path,
      bindOptions,
      signals,
      owner
    )
    restoreImpl = handle.restore
    return handle.Outlet({})
  }

  const handle: InterceptorHandle = {
    Outlet,
    isActive,
    isPending,
    restore: () => restoreImpl(),
    registrationId: -1,
    slot,
    path: def.path,
  }
  setInterceptorBindOptions(handle, bindOptions)
  return handle
}

/** @internal Slot load/render options for {@link InterceptorModuleShell} registration. */
export const INTERCEPTOR_BIND_OPTIONS = Symbol.for("kiru.interceptor.bindOptions")

type InterceptorBindOptions = {
  load?: InterceptorSlotDefinition<string, unknown>["load"]
  render: InterceptorSlotDefinition<string, unknown>["render"]
}

export function setInterceptorBindOptions(
  handle: InterceptorHandle,
  options: InterceptorBindOptions
): void {
  Object.defineProperty(handle, INTERCEPTOR_BIND_OPTIONS, {
    value: options,
    enumerable: false,
    configurable: true,
  })
}

export function readInterceptorBindOptions(
  handle: InterceptorHandle
): InterceptorBindOptions | null {
  const options = (handle as InterceptorHandle & {
    [INTERCEPTOR_BIND_OPTIONS]?: InterceptorBindOptions
  })[INTERCEPTOR_BIND_OPTIONS]
  return options ?? null
}
