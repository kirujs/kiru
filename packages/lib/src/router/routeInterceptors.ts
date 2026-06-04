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
  InterceptLoadResult,
  InterceptRenderContext,
  InterceptorHandle,
  InterceptorOptions,
  NavigatePath,
} from "./routePaths.js"
import {
  buildInterceptErrorResult,
  buildInterceptSuccessResult,
  interceptLoadResultFromState,
} from "./routePaths.js"
import type {
  CustomRequestContext,
  RouteInterceptState,
  RouteLocation,
  RouteMatch,
} from "./types.js"
import type { RouteManifest } from "./types.js"
import type { Router } from "./routerInstance.js"
import type { RouterRuntime } from "./routerRuntime.js"

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

function prefetchKeyRegistrationId(key: string): number | null {
  const end = key.indexOf(":")
  if (end < 1) return null
  const n = Number(key.slice(0, end))
  return Number.isInteger(n) ? n : null
}

/** Drop cached and in-flight interceptor prefetches for a registration (e.g. on unmount). */
export function clearInterceptorPrefetchForRegistration(
  registrationId: number
): void {
  for (const key of [...interceptorPrefetchCache.keys()]) {
    if (prefetchKeyRegistrationId(key) === registrationId) {
      interceptorPrefetchCache.delete(key)
    }
  }
  for (const key of [...interceptorPrefetchInFlight.keys()]) {
    if (prefetchKeyRegistrationId(key) === registrationId) {
      interceptorPrefetchInFlight.get(key)?.abort.abort()
      interceptorPrefetchInFlight.delete(key)
    }
  }
}

const interceptorPrefetchInFlight = new Map<
  string,
  { abort: AbortController; promise: Promise<void> }
>()

export async function prefetchInterceptorLoad(
  registration: InterceptorRegistration,
  targetMatch: RouteMatch,
  buildTargetLocation: (match: RouteMatch) => RouteLocation,
  signal: AbortSignal,
  getRequestContext: () => CustomRequestContext = () => ({})
): Promise<void> {
  if (!registration.load) return
  const key = buildInterceptorPrefetchKey(registration.id, targetMatch)
  const inFlight = interceptorPrefetchInFlight.get(key)
  if (inFlight && !inFlight.abort.signal.aborted) {
    return inFlight.promise
  }

  interceptorPrefetchInFlight.get(key)?.abort.abort()
  const abort = new AbortController()
  if (signal.aborted) {
    abort.abort()
  } else {
    signal.addEventListener("abort", () => abort.abort(), { once: true })
  }
  const loadSignal = abort.signal
  const promise = (async () => {
    try {
      const ctx: InterceptLoadContext<Record<string, string>> = {
        params: targetMatch.params,
        location: buildTargetLocation(targetMatch),
        signal: loadSignal,
        context: getRequestContext(),
      }
      const data = await registration.load!(ctx)
      if (!loadSignal.aborted) {
        setPrefetchedInterceptorData(key, data)
      }
    } catch {
      // Failed loads are not cached.
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

export function assertInterceptorSetupContext(): void {
  if (!sideEffectsEnabled()) return
  const vNode = node.current
  if (!vNode || (__DEV__ && vNode.type === $INLINE_FN)) {
    throw new Error(
      "[kiru] route interceptor Outlet must be rendered during component setup"
    )
  }
}

function validateTargetPath(manifest: RouteManifest, target: string): void {
  if (!manifest.routes.some((r) => r.path === target)) {
    throw new Error(
      `[kiru] defineRouteInterceptors path "${target}" does not match any route in the manifest`
    )
  }
}

export type RouteInterceptorSignals = {
  isActive: ReturnType<typeof signal<boolean>>
  isPending: ReturnType<typeof signal<boolean>>
}

export type InterceptorRuntimeDeps = {
  manifest: RouteManifest
  registrations: InterceptorRegistration[]
  interceptState: { value: RouteInterceptState | null }
  getBackgroundMatch: () => RouteMatch | null
  getNavSignal: () => AbortSignal
  getRequestContext: () => CustomRequestContext
  dismissIntercept: (options?: { skipHistoryBack?: boolean }) => void
  buildTargetLocation: (match: RouteMatch) => RouteLocation
}

export function buildInterceptorRuntimeDeps(
  router: Router,
  runtime: RouterRuntime
): InterceptorRuntimeDeps {
  const registrations = runtime.getRouteInterceptorRegistrations?.()
  const dismissIntercept = runtime.dismissRouteIntercept
  const buildTargetLocation = runtime.buildTargetLocation
  if (!registrations || !dismissIntercept || !buildTargetLocation) {
    throw new Error(
      "[kiru] defineRouteInterceptors requires createRouter (client history mode)"
    )
  }
  return {
    manifest: router.manifest,
    registrations: registrations as InterceptorRegistration[],
    interceptState: router.interceptState,
    getBackgroundMatch: () => router.match.peek(),
    getNavSignal: () => runtime.getNavSignal(),
    getRequestContext: () => router.requestContext.peek(),
    dismissIntercept,
    buildTargetLocation,
  }
}

let nextRegistrationId = 1

export function registerRouteInterceptor<P extends NavigatePath>(
  deps: InterceptorRuntimeDeps,
  target: P,
  options: InterceptorOptions<P>,
  fromRouteId: string,
  signals?: RouteInterceptorSignals
): InterceptorHandle {
  validateTargetPath(deps.manifest, target)

  const existing = deps.registrations.find(
    (r) => r.fromRouteId === fromRouteId && r.targetPath === target
  )
  if (existing && __DEV__) {
    warnOnce(
      `intercept-dup-${fromRouteId}-${target}`,
      `[kiru] Duplicate route interceptor for from "${fromRouteId}" → "${target}"`
    )
  }

  const id = nextRegistrationId++
  const isActive = signals?.isActive ?? signal(false)
  const isPending = signals?.isPending ?? signal(false)

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

  const reload = () => {
    void reloadInterceptorLoad(deps, id)
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
        context: deps.getRequestContext(),
        restore,
        reload,
        ...interceptLoadResultFromState(state),
      }
      return registration.render(ctx)
    }
  }

  return { Outlet, isActive, isPending, restore }
}

export function bindRouteInterceptorInSetup<P extends NavigatePath>(
  deps: InterceptorRuntimeDeps,
  target: P,
  options: InterceptorOptions<P>,
  signals?: RouteInterceptorSignals
): InterceptorHandle {
  assertInterceptorSetupContext()
  const fromRouteId = options.from ?? deps.getBackgroundMatch()?.route.id ?? "_"
  const handle = registerRouteInterceptor(
    deps,
    target,
    options,
    fromRouteId,
    signals
  )
  onCleanup(() => {
    unregisterRouteInterceptor(deps, target, fromRouteId, handle)
  })
  return handle
}

export function unregisterRouteInterceptor(
  deps: InterceptorRuntimeDeps,
  target: string,
  fromRouteId: string,
  handle: InterceptorHandle
): void {
  const reg = deps.registrations.find(
    (r) => r.targetPath === target && r.fromRouteId === fromRouteId
  )
  if (reg) {
    clearInterceptorPrefetchForRegistration(reg.id)
    const i = deps.registrations.indexOf(reg)
    if (i !== -1) deps.registrations.splice(i, 1)
    const state = deps.interceptState.value
    if (state?.registrationId === reg.id) {
      deps.dismissIntercept({ skipHistoryBack: true })
    }
  }
  handle.isActive.value = false
  handle.isPending.value = false
}

export function applyInterceptLoadResult(
  state: RouteInterceptState,
  result: InterceptLoadResult<unknown>
): RouteInterceptState {
  return {
    ...state,
    data: result.data,
    error: result.error,
  }
}

export async function runInterceptorLoad(
  deps: Pick<
    InterceptorRuntimeDeps,
    "getRequestContext" | "buildTargetLocation"
  >,
  registration: InterceptorRegistration,
  state: RouteInterceptState,
  signal: AbortSignal,
  options?: { fromPrefetch?: boolean; prefetchedData?: unknown }
): Promise<InterceptLoadResult<unknown>> {
  if (!registration.load) {
    return buildInterceptSuccessResult(undefined)
  }
  if (options?.fromPrefetch) {
    return buildInterceptSuccessResult(options.prefetchedData)
  }
  registration.isPending.value = true
  try {
    const ctx: InterceptLoadContext<Record<string, string>> = {
      params: state.targetMatch.params,
      location: deps.buildTargetLocation(state.targetMatch),
      signal,
      context: deps.getRequestContext(),
    }
    const data = await registration.load(ctx)
    return buildInterceptSuccessResult(data)
  } catch (err) {
    return buildInterceptErrorResult(err)
  } finally {
    if (!signal.aborted) {
      registration.isPending.value = false
    }
  }
}

export async function reloadInterceptorLoad(
  deps: InterceptorRuntimeDeps,
  registrationId: number
): Promise<void> {
  const state = deps.interceptState.value
  if (!state || state.registrationId !== registrationId) return
  const registration = deps.registrations.find((r) => r.id === registrationId)
  if (!registration?.load) return

  deps.interceptState.value = { ...state, error: null }

  const result = await runInterceptorLoad(
    deps,
    registration,
    deps.interceptState.value!,
    deps.getNavSignal(),
    { fromPrefetch: false }
  )
  if (deps.interceptState.value?.registrationId === registrationId) {
    deps.interceptState.value = applyInterceptLoadResult(
      deps.interceptState.value!,
      result
    )
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
