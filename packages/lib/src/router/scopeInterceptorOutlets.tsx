import { createElement, Fragment } from "../element.js"
import type { InterceptorRegistration } from "./routeInterceptors.js"
import {
  buildInterceptorRuntimeDeps,
  renderInterceptorRegistration,
  type InterceptorRuntimeDeps,
} from "./routeInterceptors.js"
import { useOptionalRouter } from "./routerContext.js"
import { getRouterInstanceRuntime } from "./routerRuntime.js"

const ScopeInterceptorSlot: Kiru.Component<{
  deps: InterceptorRuntimeDeps
  registration: InterceptorRegistration
}> = ({ deps, registration }) => {
  return () => renderInterceptorRegistration(deps, registration)
}

/** Renders scope-owned interceptor Outlets outside the route outlet remount cycle. */
export function ScopeInterceptorOutlets() {
  const router = useOptionalRouter()
  return () => {
    if (!router) return null
    void router.interceptState.value
    const runtime = getRouterInstanceRuntime(router)
    const registrations = runtime.getRouteInterceptorRegistrations?.() ?? []
    if (registrations.length === 0) return null
    const deps = buildInterceptorRuntimeDeps(router, runtime)
    const nodes: JSX.Element[] = []
    for (const reg of registrations) {
      if (reg.owner.kind !== "scope") continue
      void reg.isActive.value
      void reg.isPending.value
      nodes.push(
        createElement(ScopeInterceptorSlot, {
          key: `${reg.id}:${reg.targetPath}:${reg.isActive.value ? 1 : 0}`,
          deps,
          registration: reg,
        })
      )
    }
    if (nodes.length === 0) return null
    return createElement(Fragment, {}, nodes)
  }
}
