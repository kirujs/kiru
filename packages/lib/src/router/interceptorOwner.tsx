import { createContext, useContext } from "../context.js"
import { createElement, Fragment } from "../element.js"
import type { InterceptorHandle } from "./routePaths.js"
import type { InterceptorOwner } from "./types.js"

const InterceptorOwnerContext = createContext<InterceptorOwner | null>(null)

export function InterceptorOwnerProvider({
  owner,
  children,
}: {
  owner: InterceptorOwner
  children?: JSX.Children
}) {
  return createElement(InterceptorOwnerContext, { value: owner, children })
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

function AutoInterceptorOutlets({
  handles,
  slotNames,
}: {
  handles: Record<string, InterceptorHandle>
  slotNames: readonly string[]
}) {
  const placement = useInterceptorPlacement()
  return () => {
    if (!placement) return null
    const nodes: JSX.Element[] = []
    for (const slot of slotNames) {
      if (placement.placed.has(slot)) continue
      const handle = handles[slot]
      if (!handle) continue
      nodes.push(createElement(handle.Outlet, {}))
    }
    if (nodes.length === 0) return null
    return createElement(Fragment, {}, nodes)
  }
}

export function InterceptorModuleShell({
  handles,
  slotNames,
  children,
}: {
  handles: Record<string, InterceptorHandle>
  slotNames: readonly string[]
  children?: JSX.Children
}) {
  return createElement(InterceptorPlacementProvider, {
    slotNames,
    children: [
      children,
      createElement(AutoInterceptorOutlets, { handles, slotNames }),
    ],
  })
}
