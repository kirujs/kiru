import {
  $HMR_ACCEPT,
  STREAMED_DATA_DESCENDANTS,
  STREAMED_DATA_EVENT,
} from "./constants.js"
import { node, renderMode } from "./globals.js"
import {
  SignalHelpers,
  getSignalState,
  isSignal,
  signal,
  type Signal,
} from "./signals/base.js"
import { executeWithTracking } from "./signals/tracking.js"
import { createVNodeId, registerVNodeCleanup } from "./utils/vdom.js"
import { generateRandomID } from "./utils/generateId.js"
import { __DEV__, isBrowser } from "./env.js"
import { GenericHMRAcceptor, performHmrAccept } from "./hmr.js"
import { isInitialSsrStreamPending } from "./router/pageData.js"
import { traceReadiness } from "./hydration.js"

export type ResourceSource = Record<string, Signal<any>> | Signal<any>

type InnerOf<T> = T extends Kiru.Signal<infer V> ? V : never

type UnwrapResourceSource<T extends ResourceSource> =
  T extends Kiru.Signal<unknown>
    ? InnerOf<T>
    : { [K in keyof T]: InnerOf<T[K]> }

interface ResourceState<T> {
  error: Signal<Error | null>
  isPending: Signal<boolean>
  promise: Kiru.StatefulPromise<T>
  refetch: () => void
  dispose: () => void
}

/** A resource that provided a default state. */
export type NonNullableResource<T> = Kiru.Signal<T> & ResourceState<T>
/** A resource that may be null until it is resolved. */
export type NullableResource<T> = Kiru.Signal<T | null> & ResourceState<T>
export type Resource<T> = NonNullableResource<T> | NullableResource<T>

export type ResourceOptions<
  T,
  Source extends ResourceSource | undefined = undefined
> = Source extends ResourceSource
  ? {
      source: Source
      load: (
        source: UnwrapResourceSource<Source>,
        ctx: ResourceLoaderContext
      ) => Promise<T>
      defaultState?: T
    }
  : {
      source?: never
      load: (ctx: ResourceLoaderContext) => Promise<T>
      defaultState?: T
    }

export interface ResourceLoaderContext {
  signal: AbortSignal
}

const resourceMeta = new WeakMap<Kiru.VNode, { id: string; index: number }>()

let speculativeStreamPromiseCollector:
  | ((promise: Kiru.StatefulPromise<unknown>) => void)
  | null = null

/** Records stream resource ids discovered during a speculative SSR subtree render. */
export function withSpeculativeStreamPromiseCollector<T>(
  collect: (promise: Kiru.StatefulPromise<unknown>) => void,
  fn: () => T
): T {
  const prev = speculativeStreamPromiseCollector
  speculativeStreamPromiseCollector = collect
  try {
    return fn()
  } finally {
    speculativeStreamPromiseCollector = prev
  }
}

function getStreamedDataCache():
  | Map<string, { data?: unknown; error?: string }>
  | undefined {
  if (typeof window === "undefined") return undefined
  const map = (window as unknown as Record<string, unknown>)[
    STREAMED_DATA_EVENT
  ]
  if (
    map == null ||
    typeof map !== "object" ||
    typeof (map as Map<string, unknown>).get !== "function"
  ) {
    return undefined
  }
  return map as Map<string, { data?: unknown; error?: string }>
}

/** True when the SSR stream setup script has primed the deferred-data map. */
function isStreamedSsrClient(): boolean {
  return getStreamedDataCache() !== undefined
}

function getAnnouncedStreamDescendants(): Set<string> | undefined {
  if (typeof window === "undefined") return undefined
  const pending = (window as unknown as Record<string, unknown>)[
    STREAMED_DATA_DESCENDANTS
  ]
  if (
    pending == null ||
    typeof pending !== "object" ||
    typeof (pending as Set<string>).has !== "function"
  ) {
    return undefined
  }
  return pending as Set<string>
}

function shouldResolveDeferredPromise(promiseId: string): boolean {
  // Hydration mode alone is not enough to conclude deferred data is available.
  // Only switch to deferred-resolution when stream metadata/cache indicates this id
  // (or the initial SSR stream tail is still pending).
  const announced = getAnnouncedStreamDescendants()
  if (announced?.has(promiseId)) {
    return true
  }
  const cache = getStreamedDataCache()
  if (cache?.has(promiseId)) {
    return true
  }
  // Initial document only: wait for tail `__$k_data` scripts after `</html>`.
  return isInitialSsrStreamPending() && promiseId.startsWith("k:")
}

function isRelevantStreamId(localId: string, streamId: string): boolean {
  return localId === streamId
}

const RESOURCE_ID_SUFFIX = ":resource:"

function resourceSuffixFromPromiseId(id: string): string | null {
  const at = id.lastIndexOf(RESOURCE_ID_SUFFIX)
  if (at < 0) return null
  return id.slice(at)
}

/**
 * SSR stream scripts often run before hydrate registers listeners. When the
 * server-computed stream id differs from the client vnode id, claim the next
 * unclaimed cache entry for this resource slot (`:resource:N`) in insertion order.
 */
function tryConsumeStreamedByResourceSuffix<T>(
  localId: string,
  deferralCache: Map<string, { data?: unknown; error?: string }>,
  announced: Set<string> | undefined,
  resolve: (value: T) => void,
  reject: (reason: Error) => void
): boolean {
  if (!localId.startsWith("k:")) {
    return false
  }
  const suffix = resourceSuffixFromPromiseId(localId)
  if (!suffix) return false
  const matches: string[] = []
  for (const streamId of deferralCache.keys()) {
    if (!streamId.endsWith(suffix)) continue
    matches.push(streamId)
  }
  for (let i = 0; i < matches.length; i++) {
    const streamId = matches[i]
    if (
      consumeStreamedPayload(
        streamId,
        deferralCache,
        announced,
        resolve,
        reject
      )
    ) {
      traceReadiness("resource", {
        path: "suffix-cache",
        localId,
        streamId,
        suffix,
      })
      return true
    }
  }
  return false
}

function hasPotentialStreamedPayload(localId: string): boolean {
  const deferralCache = getStreamedDataCache()
  if (!deferralCache) return false
  if (deferralCache.has(localId)) return true
  if (localId.startsWith("k:")) {
    const suffix = resourceSuffixFromPromiseId(localId)
    if (suffix) {
      for (const streamId of deferralCache.keys()) {
        if (streamId.endsWith(suffix)) return true
      }
      const announced = getAnnouncedStreamDescendants()
      if (announced) {
        for (const streamId of announced) {
          if (streamId.endsWith(suffix)) return true
        }
      }
    }
  }
  const announced = getAnnouncedStreamDescendants()
  return announced?.has(localId) ?? false
}

export function resource<T>(
  callback: (ctx: ResourceLoaderContext) => Promise<T>
): NullableResource<T>
export function resource<T>(
  options: ResourceOptions<T, undefined>
): NullableResource<T>
export function resource<T, Source extends ResourceSource>(
  options: ResourceOptions<T, Source> & { defaultState: T }
): Resource<T>
export function resource<T, Source extends ResourceSource>(
  options: ResourceOptions<T, Source>
): NullableResource<T>
export function resource<T, Source extends ResourceSource>(
  callbackOrOptions:
    | ResourceOptions<T, Source>
    | ((ctx: ResourceLoaderContext) => Promise<T>)
): Resource<T> | NullableResource<T> {
  const options: ResourceOptions<T, Source> =
    typeof callbackOrOptions === "function"
      ? ({ load: callbackOrOptions } as ResourceOptions<T, Source>)
      : callbackOrOptions
  const defaultState =
    "defaultState" in options ? options.defaultState : undefined
  const hasDefaultState = defaultState !== undefined
  const data = hasDefaultState
    ? signal(defaultState as T)
    : signal<T | null>(null)
  const { load } = options
  const source = "source" in options ? options.source : undefined
  const error = signal<Error | null>(null)
  const isPending = signal(true)

  let controller = new AbortController()

  let promiseId = ""
  const vNode = node.current
  if (!vNode) {
    // todo: investigate streaming global resources via SSR
    // likely cooked since we can't ensure modules are loaded in the same order,
  } else if (
    renderMode.current === "hydrate" ||
    renderMode.current === "stream" ||
    isStreamedSsrClient()
  ) {
    // hydrate or stream - create a deterministic id + index offset to use for promise hydration
    const { id, index } = resourceMeta.get(vNode) ?? {
      id: createVNodeId(vNode),
      index: 0,
    }
    promiseId = `${id}:resource:${index}`
    resourceMeta.set(vNode, { id, index: index + 1 })
  } else {
    // could be improved. For now, just use a random id to prevent collisions on the cleanups map.
    // in future, we could implement a cached id based on the vNode for use across other modules too.
    promiseId = generateRandomID()
  }

  const updateResource = () => {
    resource.promise = createPromise()
    data.notify()
  }

  let unsubFromSource: (() => void) | undefined
  if (source != null) {
    if (isSignal(source)) {
      unsubFromSource = source.subscribe(updateResource)
    } else {
      const unsubs: (() => void)[] = []
      for (const key in source) {
        if (!isSignal(source[key])) continue
        unsubs.push(source[key].subscribe(updateResource))
      }
      unsubFromSource = () => {
        unsubs.forEach((unsub) => unsub())
      }
    }
  }

  const observedSignalUnsubs = new Map<string, () => void>()
  const dispose = () => {
    if (!controller.signal.aborted) controller.abort()
    SignalHelpers.dispose(data)
    SignalHelpers.dispose(isPending)
    observedSignalUnsubs.forEach((unsub) => unsub())
    unsubFromSource?.()
  }

  if (vNode) {
    registerVNodeCleanup(vNode, promiseId, dispose)
  }

  let promise: Kiru.StatefulPromise<T>
  const resource = Object.assign(data, {
    error,
    isPending,
    get promise() {
      return (promise ??= createPromise())
    },
    set promise(newPromise) {
      promise = newPromise
    },
    refetch() {
      if (hasDefaultState) {
        ;(data as Signal<T>).set(defaultState as T)
      } else {
        ;(data as Signal<T | null>).set(null)
      }
      resource.promise = createPromise(true)
    },
    dispose,
  })

  if (__DEV__) {
    const { inject: baseInject, destroy: baseDestroy } = getSignalState(
      data as Signal<T | null>
    )[$HMR_ACCEPT]!

    ;(resource as any as GenericHMRAcceptor<Resource<T>>)[$HMR_ACCEPT] = {
      provide: () => {
        return resource
      },
      destroy: () => {
        baseDestroy()
        controller.abort()
      },
      inject: (prev) => {
        baseInject(getSignalState(prev as Signal<T | null>))
        const { isPending: prevPending, error: prevError } = prev
        const { isPending, error } = resource
        performHmrAccept(
          getSignalState(prevPending)[$HMR_ACCEPT]!,
          getSignalState(isPending)[$HMR_ACCEPT]!
        )
        performHmrAccept(
          getSignalState(prevError)[$HMR_ACCEPT]!,
          getSignalState(error)[$HMR_ACCEPT]!
        )
      },
    }
  }

  function createPromise(forceFetch = false): Kiru.StatefulPromise<T> {
    controller.abort()
    const ctrl = (controller = new AbortController())
    isPending.set(true)
    const newPromise = executeWithTracking({
      fn: () => {
        let promise: Promise<T>
        if (renderMode.current === "string") {
          // if we're rendering to a string, there's no need to fire the callback
          promise = Promise.resolve() as Promise<T>
    } else if (
      !forceFetch &&
      shouldResolveDeferredPromise(promiseId) &&
      (renderMode.current === "hydrate" || hasPotentialStreamedPayload(promiseId))
    ) {
          traceReadiness("resource", {
            path: "deferred",
            promiseId,
            renderMode: renderMode.current,
          })
          promise = resolveDeferredPromise<T>(promiseId, ctrl.signal)
        } else {
          traceReadiness("resource", {
            path: "load",
            promiseId,
            renderMode: renderMode.current,
          })
          // stream / dom / (hydrate + static)
          const ctx: ResourceLoaderContext = { signal: ctrl.signal }
          if (source == null) {
            promise = (load as (ctx: ResourceLoaderContext) => Promise<T>)(ctx)
          } else {
            promise = (
              load as (
                source: UnwrapResourceSource<ResourceSource>,
                ctx: ResourceLoaderContext
              ) => Promise<T>
            )(unwrapResourceSource(source), ctx)
          }
        }
        return promise
      },
      id: SignalHelpers.id(data),
      onDepChanged: updateResource,
      subs: observedSignalUnsubs,
    })

    const statefulPromise: Kiru.StatefulPromise<T> = Object.assign(newPromise, {
      id: promiseId,
      state: "pending",
    } satisfies Kiru.PromiseState<T>)

    if (
      renderMode.current === "stream" &&
      promiseId.startsWith("k:") &&
      speculativeStreamPromiseCollector
    ) {
      speculativeStreamPromiseCollector(
        statefulPromise as Kiru.StatefulPromise<unknown>
      )
    }

    statefulPromise
      .then((value) => {
        statefulPromise.state = "fulfilled"
        statefulPromise.value = value

        if (ctrl !== controller) return
        data.set(value)
        isPending.set(false)
        error.set(null)
      })
      .catch((e) => {
        statefulPromise.state = "rejected"
        statefulPromise.error = e instanceof Error ? e : new Error(e)

        if (ctrl !== controller) return
        error.set(statefulPromise.error)
        isPending.set(false)
      })
    return statefulPromise
  }

  if (__DEV__ && isBrowser && window.__kiru.HMRContext?.isReplacement()) {
    queueMicrotask(() => (resource.promise = createPromise()))
  } else {
    resource.promise ??= createPromise()
  }

  return resource as Resource<T> | NullableResource<T>
}

interface DeferredPromiseEventDetail<T> {
  id: string
  data?: T
  error?: string
}

function consumeStreamedPayload<T>(
  streamId: string,
  deferralCache: Map<string, { data?: unknown; error?: string }>,
  announced: Set<string> | undefined,
  resolve: (value: T) => void,
  reject: (reason: Error) => void
): boolean {
  const existing = deferralCache.get(streamId)
  if (!existing) return false

  deferralCache.delete(streamId)
  announced?.delete(streamId)

  const { data, error } = existing
  if (error) {
    reject(new Error(error))
    return true
  }
  resolve(data as T)
  return true
}

function resolveDeferredPromise<T>(
  id: string,
  signal: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const deferralCache = getStreamedDataCache()
    if (!deferralCache) {
      return reject(new Error("Streamed SSR data cache is not available"))
    }

    const announced = getAnnouncedStreamDescendants()

    if (consumeStreamedPayload(id, deferralCache, announced, resolve, reject)) {
      traceReadiness("resource", { path: "cache-hit", promiseId: id, streamId: id })
      return
    }

    if (
      tryConsumeStreamedByResourceSuffix(
        id,
        deferralCache,
        announced,
        resolve,
        reject
      )
    ) {
      return
    }

    const onDataEvent = (event: Event) => {
      const { detail } = event as CustomEvent<DeferredPromiseEventDetail<T>>
      if (!isRelevantStreamId(id, detail.id)) return
      window.removeEventListener(STREAMED_DATA_EVENT, onDataEvent)
      traceReadiness("resource", {
        path: "event",
        promiseId: id,
        streamId: detail.id,
      })

      if (
        consumeStreamedPayload(
          detail.id,
          deferralCache,
          announced,
          resolve,
          reject
        )
      ) {
        return
      }

      announced?.delete(detail.id)
      if (detail.error) return reject(new Error(detail.error))
      resolve(detail.data!)
    }

    window.addEventListener(STREAMED_DATA_EVENT, onDataEvent)
    signal.addEventListener("abort", () => {
      window.removeEventListener(STREAMED_DATA_EVENT, onDataEvent)
      reject(new Error("Aborted"))
    })
  })
}

/**
 * Returns true if the value is a {@link Resource} or {@link NullableResource}
 */
export function isResource(thing: unknown): thing is Resource<unknown> {
  return (
    isSignal(thing) &&
    "promise" in thing &&
    thing["promise"] instanceof Promise
  )
}

function unwrapResourceSource<T extends ResourceSource>(
  source: T
): UnwrapResourceSource<T> {
  if (isSignal(source)) {
    return source.peek() as UnwrapResourceSource<T>
  }
  const out: Record<string, unknown> = {}
  for (const key in source) {
    if (isSignal(source[key])) {
      out[key] = source[key].peek()
    }
  }
  return out as UnwrapResourceSource<T>
}
