import { createContext, useContext } from "../context.js"
import { createElement, Fragment } from "../element.js"
import { onMount } from "../hooks/onMount.js"
import { signal } from "../signals/base.js"
import { readInterceptorBindOptions } from "./defineInterceptors.js"
import type { InterceptorHandle } from "./routePaths.js"
import { logOutletDebug } from "./outletDebug.js"
import {
  buildInterceptorRuntimeDeps,
  registerRouteInterceptor,
  syncAllInterceptorHandlesActive,
  unregisterRouteInterceptor,
} from "./routeInterceptors.js"
import { useOptionalRouter } from "./routerContext.js"
import { getRouterInstanceRuntime } from "./routerRuntime.js"
import type { InterceptorOwner } from "./types.js"

const InterceptorOwnerContext = createContext<InterceptorOwner | null>(null)

const InterceptorOutletsContext = createContext<
  ReturnType<typeof signal<Record<string, Kiru.Component>>>
>(null as unknown as ReturnType<typeof signal<Record<string, Kiru.Component>>>)

export function InterceptorOwnerProvider({
  owner,
  handles,
  slotNames,
  children,
}: {
  owner: InterceptorOwner
  handles?: Record<string, InterceptorHandle>
  slotNames?: readonly string[]
  children?: JSX.Children
}) {
  const router = useOptionalRouter()
  const outlets = signal<Record<string, Kiru.Component>>({})

  if (handles && slotNames) {
    const { outlets: registeredOutlets } = registerMissingShellInterceptors(
      router,
      owner,
      handles,
      slotNames,
      true
    )
    if (Object.keys(registeredOutlets).length > 0) {
      outlets.value = registeredOutlets
    }
  }

  onMount(() => {
    if (!handles || !slotNames || !router) return
    let disposed = false
    const mountedRef: {
      current: Array<{
        target: string
        owner: InterceptorOwner
        handle: InterceptorHandle
      }>
    } = { current: [] }
    queueMicrotask(() => {
      if (disposed) return
      const { outlets: registeredOutlets, mounted } =
        registerMissingShellInterceptors(
          router,
          owner,
          handles,
          slotNames,
          false
        )
      mountedRef.current = mounted
      if (Object.keys(registeredOutlets).length > 0) {
        outlets.value = { ...outlets.value, ...registeredOutlets }
      }
    })

    const unsubIntercept = router.interceptState.subscribe((state) => {
      if (!handles || !slotNames) return
      const { outlets: registeredOutlets } = registerMissingShellInterceptors(
        router,
        owner,
        handles,
        slotNames,
        false
      )
      if (Object.keys(registeredOutlets).length > 0) {
        outlets.value = { ...outlets.value, ...registeredOutlets }
      }
      const runtime = getRouterInstanceRuntime(router)
      if (runtime.getRouteInterceptorRegistrations) {
        const deps = buildInterceptorRuntimeDeps(router, runtime)
        syncAllInterceptorHandlesActive(deps.registrations, state)
      }
    })

    return () => {
      disposed = true
      unsubIntercept()
      const toUnregister = [...mountedRef.current]
      mountedRef.current = []
      queueMicrotask(() => {
        if (toUnregister.length === 0 || !router) return
        const runtime = getRouterInstanceRuntime(router)
        if (!runtime.registerRouteInterceptor) return
        const deps = buildInterceptorRuntimeDeps(router, runtime)
        for (const item of toUnregister) {
          if (item.owner.kind === "scope") continue
          logOutletDebug("interceptor:unregister", {
            target: item.target,
            ownerKind: item.owner.kind,
          })
          unregisterRouteInterceptor(deps, item.target, item.owner, item.handle)
        }
      })
    }
  })

  return createElement(InterceptorOwnerContext, {
    value: owner,
    children: createElement(InterceptorOutletsContext, {
      value: outlets,
      children,
    }),
  })
}

export function useInterceptorOwner(): InterceptorOwner | null {
  return useContext(InterceptorOwnerContext)
}

const InterceptorPlacementContext = createContext<{
  placed: Set<string>
  markPlaced: (slot: string) => void
} | null>(null)

export function InterceptorPlacementProvider({
  children,
}: {
  slotNames: readonly string[]
  children?: JSX.Children
}) {
  const placed = new Set<string>()
  const markPlaced = (slot: string) => {
    placed.add(slot)
  }
  return createElement(InterceptorPlacementContext, {
    value: { placed, markPlaced },
    children,
  })
}

export function useInterceptorPlacement(): {
  placed: Set<string>
  markPlaced: (slot: string) => void
} | null {
  return useContext(InterceptorPlacementContext)
}

function registerMissingShellInterceptors(
  router: ReturnType<typeof useOptionalRouter>,
  owner: InterceptorOwner,
  handles: Record<string, InterceptorHandle>,
  slotNames: readonly string[],
  bindInSetup: boolean
): {
  outlets: Record<string, Kiru.Component>
  mounted: Array<{
    target: string
    owner: InterceptorOwner
    handle: InterceptorHandle
  }>
} {
  if (!router) {
    return { outlets: {}, mounted: [] }
  }
  const runtime = getRouterInstanceRuntime(router)
  if (!runtime.registerRouteInterceptor) {
    return { outlets: {}, mounted: [] }
  }
  const deps = buildInterceptorRuntimeDeps(router, runtime)
  const outlets: Record<string, Kiru.Component> = {}
  const mounted: Array<{
    target: string
    owner: InterceptorOwner
    handle: InterceptorHandle
  }> = []

  for (const slot of slotNames) {
    const handle = handles[slot]
    if (!handle) continue
    const options = readInterceptorBindOptions(handle)
    if (!options) continue

    const bound = registerRouteInterceptor(
      deps,
      handle.path,
      options,
      owner,
      { isActive: handle.isActive, isPending: handle.isPending }
    )

    outlets[slot] = bound.Outlet
    logOutletDebug("interceptor:register", {
      slot,
      target: handle.path,
      ownerKind: owner.kind,
      bindInSetup,
    })
    if (!bindInSetup) {
      mounted.push({ target: handle.path, owner, handle: bound })
    }
  }

  return { outlets, mounted }
}

function RegisteredInterceptorOutlets({
  slotNames,
}: {
  slotNames: readonly string[]
  handles?: Record<string, InterceptorHandle>
}) {
  // Scope-owned interceptors render from ScopeInterceptorOutlets at the router shell.
  const owner = useInterceptorOwner()
  if (owner?.kind === "scope") {
    return () => null
  }
  const router = useOptionalRouter()
  const outletsSignal = useContext(InterceptorOutletsContext)
  return () => {
    void router?.interceptState.value
    const outlets = outletsSignal.value
    const nodes: JSX.Element[] = []
    for (const slot of slotNames) {
      const Outlet = outlets[slot]
      if (!Outlet) continue
      nodes.push(createElement(Outlet, { key: slot }))
    }
    if (nodes.length === 0) return null
    return createElement(Fragment, {}, nodes)
  }
}

export function InterceptorModuleShell({
  slotNames,
  handles,
  children,
}: {
  handles: Record<string, InterceptorHandle>
  slotNames: readonly string[]
  children?: JSX.Children
}) {
  return () =>
    createElement(InterceptorPlacementProvider, {
      slotNames,
      children: [
        children,
        createElement(RegisteredInterceptorOutlets, { slotNames, handles }),
      ],
    })
}
