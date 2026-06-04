import { signal } from "../signals/base.js"
import { $INLINE_FN } from "../constants.js"
import { __DEV__ } from "../env.js"
import { node } from "../globals.js"
import { onCleanup } from "../hooks/onCleanup.js"
import { sideEffectsEnabled } from "../utils/index.js"
import { warnOnce } from "./devWarnings.dev.js"
import type { RouteLocationParts } from "./navigation.js"
import type {
  InterceptLoadContext,
  InterceptRenderContext,
  InterceptorHandle,
  InterceptorOptions,
  NavigatePath,
} from "./routePaths.js"
import type { RouteInterceptState, RouteLocation, RouteMatch } from "./types.js"
import type { RouteManifest } from "./types.js"

export type InterceptorRegistration = {
  id: number
  fromRouteId: string
  targetPath: string
  load?: InterceptorOptions<string>["load"]
  render: InterceptorOptions<string>["render"]
  isActive: ReturnType<typeof signal<boolean>>
  isPending: ReturnType<typeof signal<boolean>>
}

export type KiruHistoryInterceptState = {
  registrationId: number
  background: RouteLocationParts
  backgroundParams: Record<string, string>
}

export function buildInterceptorPrefetchKey(
  registrationId: number,
  targetMatch: RouteMatch
): string {
  return `${registrationId}:${targetMatch.route.path}:${JSON.stringify(
    targetMatch.params
  )}`
}

const interceptorPrefetchCache = new Map<string, unknown>()

export type InterceptorPrefetchConsume =
  | { kind: "hit"; data: unknown }
  | { kind: "miss" }

export function consumePrefetchedInterceptorData(
  key: string
): InterceptorPrefetchConsume {
  if (!interceptorPrefetchCache.has(key)) return { kind: "miss" }
  const data = interceptorPrefetchCache.get(key)
  interceptorPrefetchCache.delete(key)
  return { kind: "hit", data }
}

export function setPrefetchedInterceptorData(key: string, data: unknown): void {
  interceptorPrefetchCache.set(key, data)
}

const interceptorPrefetchInFlight = new Map<
  string,
  { abort: AbortController; promise: Promise<void> }
>()

export async function prefetchInterceptorLoad(
  registration: InterceptorRegistration,
  targetMatch: RouteMatch,
  buildTargetLocation: (match: RouteMatch) => RouteLocation,
  signal: AbortSignal
): Promise<void> {
  if (!registration.load) return
  const key = buildInterceptorPrefetchKey(registration.id, targetMatch)
  const inFlight = interceptorPrefetchInFlight.get(key)
  if (inFlight && !inFlight.abort.signal.aborted) {
    return inFlight.promise
  }

  interceptorPrefetchInFlight.get(key)?.abort.abort()
  const abort = new AbortController()
  const promise = (async () => {
    try {
      const ctx: InterceptLoadContext<Record<string, string>> = {
        params: targetMatch.params,
        location: buildTargetLocation(targetMatch),
        signal,
      }
      const data = await registration.load!(ctx)
      if (!signal.aborted) {
        setPrefetchedInterceptorData(key, data)
      }
    } catch {
      if (!signal.aborted) return
    }
  })()
  interceptorPrefetchInFlight.set(key, { abort, promise })
  try {
    await promise
  } finally {
    if (interceptorPrefetchInFlight.get(key)?.abort === abort) {
      interceptorPrefetchInFlight.delete(key)
    }
  }
}

export function findMatchingInterceptor(
  registrations: readonly InterceptorRegistration[],
  fromMatch: RouteMatch,
  toMatch: RouteMatch
): InterceptorRegistration | null {
  for (const reg of registrations) {
    if (
      reg.fromRouteId === fromMatch.route.id &&
      reg.targetPath === toMatch.route.path
    ) {
      return reg
    }
  }
  return null
}

function assertSetupContext(): void {
  if (!sideEffectsEnabled()) return
  const vNode = node.current
  if (!vNode || (__DEV__ && vNode.type === $INLINE_FN)) {
    throw new Error(
      "[kiru] router.createInterceptor must be called during component setup"
    )
  }
}

function validateTargetPath(manifest: RouteManifest, target: string): void {
  if (!manifest.routes.some((r) => r.path === target)) {
    throw new Error(
      `[kiru] createInterceptor target "${target}" does not match any route in the manifest`
    )
  }
}

export type InterceptorRuntimeDeps = {
  manifest: RouteManifest
  registrations: InterceptorRegistration[]
  interceptState: { value: RouteInterceptState | null }
  getBackgroundMatch: () => RouteMatch | null
  getNavSignal: () => AbortSignal
  dismissIntercept: (options?: { skipHistoryBack?: boolean }) => void
  buildTargetLocation: (match: RouteMatch) => RouteLocation
}

let nextRegistrationId = 1

export function registerRouteInterceptor<P extends NavigatePath>(
  deps: InterceptorRuntimeDeps,
  target: P,
  options: InterceptorOptions<P>,
  fromRouteId: string
): InterceptorHandle {
  validateTargetPath(deps.manifest, target)

  const existing = deps.registrations.find(
    (r) => r.fromRouteId === fromRouteId && r.targetPath === target
  )
  if (existing && __DEV__) {
    warnOnce(
      `intercept-dup-${fromRouteId}-${target}`,
      `[kiru] Duplicate createInterceptor for from "${fromRouteId}" → "${target}"`
    )
  }

  const id = nextRegistrationId++
  const isActive = signal(false)
  const isPending = signal(false)

  const registration: InterceptorRegistration = {
    id,
    fromRouteId,
    targetPath: target,
    load: options.load as InterceptorOptions<string>["load"],
    render: options.render as InterceptorOptions<string>["render"],
    isActive,
    isPending,
  }
  deps.registrations.push(registration)

  const restore = () => {
    const state = deps.interceptState.value
    if (state?.registrationId === id) {
      deps.dismissIntercept()
    }
  }

  const Outlet: Kiru.Component = () => {
    return () => {
      if (!isActive.peek()) return null
      const state = deps.interceptState.value
      if (!state || state.registrationId !== id) return null
      const ctx: InterceptRenderContext<Record<string, string>> = {
        params: state.targetMatch.params,
        location: deps.buildTargetLocation(state.targetMatch),
        signal: deps.getNavSignal(),
        restore,
        data: state.data,
      }
      return registration.render(ctx)
    }
  }

  return { Outlet, isActive, isPending, restore }
}

export function createRouterInterceptor<P extends NavigatePath>(
  deps: InterceptorRuntimeDeps,
  target: P,
  options: InterceptorOptions<P>
): InterceptorHandle {
  assertSetupContext()
  const fromRouteId = options.from ?? deps.getBackgroundMatch()?.route.id ?? "_"
  const handle = registerRouteInterceptor(deps, target, options, fromRouteId)
  onCleanup(() => {
    const reg = deps.registrations.find(
      (r) => r.targetPath === target && r.fromRouteId === fromRouteId
    )
    if (reg) {
      const i = deps.registrations.indexOf(reg)
      if (i !== -1) deps.registrations.splice(i, 1)
      const state = deps.interceptState.value
      if (state?.registrationId === reg.id) {
        deps.dismissIntercept({ skipHistoryBack: true })
      }
    }
    handle.isActive.value = false
    handle.isPending.value = false
  })
  return handle
}

export async function runInterceptorLoad(
  registration: InterceptorRegistration,
  state: RouteInterceptState,
  buildTargetLocation: (match: RouteMatch) => RouteLocation,
  signal: AbortSignal,
  options?: { fromPrefetch?: boolean; prefetchedData?: unknown }
): Promise<unknown | undefined> {
  if (!registration.load) return undefined
  if (options?.fromPrefetch) {
    return options.prefetchedData
  }
  registration.isPending.value = true
  try {
    const ctx: InterceptLoadContext<Record<string, string>> = {
      params: state.targetMatch.params,
      location: buildTargetLocation(state.targetMatch),
      signal,
    }
    return await registration.load(ctx)
  } finally {
    if (!signal.aborted) {
      registration.isPending.value = false
    }
  }
}

export function syncInterceptorHandleActive(
  registration: InterceptorRegistration,
  state: RouteInterceptState | null
): void {
  registration.isActive.value =
    state !== null && state.registrationId === registration.id
}

export function syncAllInterceptorHandlesActive(
  registrations: readonly InterceptorRegistration[],
  state: RouteInterceptState | null
): void {
  for (const reg of registrations) {
    syncInterceptorHandleActive(reg, state)
  }
}
