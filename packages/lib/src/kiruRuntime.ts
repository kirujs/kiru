import {
  createKiruGlobalContext,
  type KiruGlobalContext,
  type KiruLazyRuntimeBag,
  type KiruRouterRuntimeBag,
} from "./globalContext.js"

export type KiruGlobalWithRuntime = KiruGlobalContext

export function getKiruGlobal(): KiruGlobalWithRuntime | undefined {
  if (typeof window === "undefined") return undefined
  return (window as Window & { __kiru?: KiruGlobalWithRuntime }).__kiru
}

export function ensureKiruGlobal(): KiruGlobalWithRuntime {
  if (typeof window === "undefined") {
    throw new Error("[kiru] window.__kiru is only available in the browser")
  }
  const w = window as Window & { __kiru?: KiruGlobalWithRuntime }
  return (w.__kiru ??= createKiruGlobalContext())
}

export function ensureKiruRouterRuntime(): KiruRouterRuntimeBag {
  const g = ensureKiruGlobal()
  return (g.router ??= {})
}

export function ensureKiruLazyRuntime(): KiruLazyRuntimeBag {
  const g = ensureKiruGlobal()
  return (g.lazy ??= { cache: new Map() })
}

export function resetKiruRouterRuntimeForTests(): void {
  const g = getKiruGlobal()
  if (g) delete g.router
}
