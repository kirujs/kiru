import {
  $HMR_ACCEPT,
  STREAMED_DATA_DESCENDANTS,
  STREAMED_DATA_EVENT,
} from "./constants.js"
import { hydrationMode, node, renderMode } from "./globals.js"
import { Signal, signal } from "./signals/base.js"
import { executeWithTracking } from "./signals/tracking.js"
import { createVNodeId, registerVNodeCleanup } from "./utils/vdom.js"
import { generateRandomID } from "./utils/generateId.js"
import { __DEV__, isBrowser } from "./env.js"
import { GenericHMRAcceptor, performHmrAccept } from "./hmr.js"
import { isInitialSsrStreamPending } from "./router/pageData.js"
import { runWithRemoteAbortSignalAsync } from "./remote/abortScope.js"
import { isRemoteQuery, type RemoteQuery } from "./remote/query.js"
import {
  buildQueryWireRefId,
  getQueryCacheEntry,
  getQueryCacheEntryForKey,
} from "./remote/queryCache.js"
import {
  buildQueryCacheKeyForQuery,
  invokeQueryLoad,
  invokeQueryLoadWithObservation,
} from "./remote/queryResourceLoad.js"
import { resolveStreamRefPayload } from "./router/dataRefs.js"
import {
  captureSyncQueryObservations,
  createQueryCacheSubscriptionBinder,
} from "./remote/queryCacheTrack.js"
import { getSsrRenderAbortSignal } from "./remote/ssrRemoteScope.js"
import { devBootstrapTrace } from "./dev/bootstrapTrace.js"

export type ResourceSource = Record<string, Signal<unknown>> | Signal<unknown>

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

/** `source` for a parametric query bound via `resource({ source, load: query })`. */
export type QueryResourceSource<Input> = Input extends void
  ? never
  : Input extends Record<string, unknown>
    ? { [K in keyof Input]: Signal<Input[K]> }
    : Signal<Input>

export type QueryResourceOptions<Input, Output> = Input extends void
  ? {
      load: RemoteQuery<void, Output>
      defaultState?: Output
    }
  : {
      source: QueryResourceSource<Input>
      load: RemoteQuery<Input, Output>
      defaultState?: Output
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

function isStringKeyedMap(
  value: unknown
): value is Map<string, { data?: unknown; error?: string }> {
  return (
    value instanceof Map ||
    (typeof value === "object" &&
      value !== null &&
      "get" in value &&
      typeof (value as { get: unknown }).get === "function")
  )
}

function getStreamedDataCache():
  | Map<string, { data?: unknown; error?: string }>
  | undefined {
  if (typeof window === "undefined") return undefined
  const map = Reflect.get(window, STREAMED_DATA_EVENT)
  return isStringKeyedMap(map) ? map : undefined
}

/** True when the SSR stream setup script has primed the deferred-data map. */
function isStreamedSsrClient(): boolean {
  return getStreamedDataCache() !== undefined
}

function isStringSet(value: unknown): value is Set<string> {
  return (
    value instanceof Set ||
    (typeof value === "object" &&
      value !== null &&
      "has" in value &&
      typeof (value as { has: unknown }).has === "function")
  )
}

function getAnnouncedStreamDescendants(): Set<string> | undefined {
  if (typeof window === "undefined") return undefined
  const pending = Reflect.get(window, STREAMED_DATA_DESCENDANTS)
  return isStringSet(pending) ? pending : undefined
}

function shouldResolveDeferredPromise(promiseId: string): boolean {
  if (renderMode.current === "hydrate" && hydrationMode.current === "dynamic") {
    return true
  }
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
  return (
    localId === streamId ||
    getAnnouncedStreamDescendants()?.has(streamId) === true
  )
}

type ResourceCallback<T> =
  | ((ctx: ResourceLoaderContext) => Promise<T>)
  | (() => Promise<T>)

function normalizeResourceCallback<T>(
  fn: ResourceCallback<T>
): (ctx: ResourceLoaderContext) => Promise<T> {
  if (fn.length === 0) {
    return () => (fn as () => Promise<T>)()
  }
  return fn as (ctx: ResourceLoaderContext) => Promise<T>
}

export function resource<T>(callback: ResourceCallback<T>): NullableResource<T>
export function resource<Output>(
  options: QueryResourceOptions<void, Output> & { defaultState: Output }
): NonNullableResource<Output>
export function resource<Output>(
  options: QueryResourceOptions<void, Output>
): NullableResource<Output>
export function resource<Input, Output>(
  options: QueryResourceOptions<Input, Output> & { defaultState: Output }
): NonNullableResource<Output>
export function resource<Input, Output>(
  options: QueryResourceOptions<Input, Output>
): NullableResource<Output>
export function resource<T, Source extends ResourceSource>(
  options: ResourceOptions<T, Source> & { defaultState: T }
): NonNullableResource<T>
export function resource<T>(
  options: ResourceOptions<T, undefined>
): NullableResource<T>
export function resource<T, Source extends ResourceSource>(
  options: ResourceOptions<T, Source>
): NullableResource<T>
export function resource(
  callbackOrOptions: unknown
): Resource<unknown> | NullableResource<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return resourceImpl(callbackOrOptions as any)
}

function resourceImpl<T, Source extends ResourceSource>(
  callbackOrOptions:
    | ResourceOptions<T, Source>
    | QueryResourceOptions<unknown, T>
    | ResourceCallback<T>
): Resource<T> | NullableResource<T> {
  const options =
    typeof callbackOrOptions === "function"
      ? ({
          load: normalizeResourceCallback(callbackOrOptions),
        } as ResourceOptions<T, Source>)
      : (callbackOrOptions as ResourceOptions<T, Source>)
  const defaultState =
    "defaultState" in options ? options.defaultState : undefined
  const hasDefaultState = defaultState !== undefined
  const data = hasDefaultState
    ? signal(defaultState as T)
    : signal<T | null>(null)
  const { load } = options
  const source = "source" in options ? options.source : undefined
  const queryAsLoad = isRemoteQuery(load)
    ? (load as RemoteQuery<unknown, T>)
    : undefined
  if (__DEV__ && queryAsLoad && !queryAsLoad.__kiruQueryVoid && source == null) {
    throw new Error(
      "resource({ load: query }) requires `source` for queries with input"
    )
  }
  const error = signal<Error | null>(null)
  const isPending = signal(true)

  /** Client-only; not allocated during SSR render (borrow {@link getSsrRenderAbortSignal}). */
  let controller: AbortController | undefined
  let loadGeneration = 0

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
    resource.notify()
  }

  let unsubFromSource: (() => void) | undefined
  if (source != null) {
    if (Signal.isSignal(source)) {
      unsubFromSource = source.subscribe(updateResource)
    } else {
      const unsubs: (() => void)[] = []
      for (const key in source) {
        if (!Signal.isSignal(source[key])) continue
        unsubs.push(source[key].subscribe(updateResource))
      }
      unsubFromSource = () => {
        unsubs.forEach((unsub) => unsub())
      }
    }
  }

  const observedSignalUnsubs = new Map<string, () => void>()
  const queryCacheBinder = isBrowser
    ? createQueryCacheSubscriptionBinder(() => {
        resource.refetch()
      })
    : undefined

  const reconcileQueryCacheKeys = (keys: Set<string>, input?: unknown) => {
    if (!isBrowser || !queryCacheBinder) return
    if (queryAsLoad) {
      keys.add(buildQueryCacheKeyForQuery(queryAsLoad, input))
    }
    queryCacheBinder.reconcile(keys)
  }

  const dispose = () => {
    if (controller && !controller.signal.aborted) controller.abort()
    Signal.dispose(data)
    Signal.dispose(isPending)
    observedSignalUnsubs.forEach((unsub) => unsub())
    queryCacheBinder?.dispose()
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
      data.value = hasDefaultState ? (defaultState as T) : null
      resource.promise = createPromise(true)
    },
    dispose,
  })

  if (__DEV__) {
    const { inject: baseInject, destroy: baseDestroy } = data[$HMR_ACCEPT]!

    ;(resource as any as GenericHMRAcceptor<Resource<T>>)[$HMR_ACCEPT] = {
      provide: () => {
        return resource
      },
      destroy: () => {
        baseDestroy()
        controller?.abort()
      },
      inject: (prev) => {
        baseInject(prev)
        const { isPending: prevPending, error: prevError } = prev
        const { isPending, error } = resource
        performHmrAccept(prevPending[$HMR_ACCEPT]!, isPending[$HMR_ACCEPT]!)
        performHmrAccept(prevError[$HMR_ACCEPT]!, error[$HMR_ACCEPT]!)
      },
    }
  }

  function createPromise(forceFetch = false): Kiru.StatefulPromise<T> {
    const ssrSignal = getSsrRenderAbortSignal()
    let signal: AbortSignal
    let loadGen: number
    if (ssrSignal) {
      signal = ssrSignal
      loadGen = ++loadGeneration
    } else {
      controller?.abort()
      const ctrl = (controller = new AbortController())
      signal = ctrl.signal
      loadGen = ++loadGeneration
    }
    const isCurrentLoad = () => loadGen === loadGeneration
    isPending.value = true

    const preferSeededQueryCache =
      typeof window === "undefined" ||
      renderMode.current === "hydrate" ||
      (isInitialSsrStreamPending() && promiseId.startsWith("k:"))

    const canShortCircuitQueryCache =
      queryAsLoad && !forceFetch && preferSeededQueryCache

    if (canShortCircuitQueryCache) {
      const input =
        source == null
          ? undefined
          : unwrapResourceSource(source as ResourceSource)
      const cacheKey = buildQueryCacheKeyForQuery(queryAsLoad, input)
      const cached =
        typeof window === "undefined"
          ? getQueryCacheEntry(cacheKey)
          : getQueryCacheEntryForKey(cacheKey)
      if (
        cached?.data !== undefined &&
        (!cached.pending || preferSeededQueryCache)
      ) {
        const value = cached.data as T
        data.value = value
        isPending.value = false
        error.value = null
        const statefulPromise = Object.assign(Promise.resolve(value), {
          id: promiseId,
          state: "fulfilled" as const,
          value,
          __kiruQueryCacheKey: buildQueryWireRefId(cacheKey),
        }) as Kiru.StatefulPromise<T> & { __kiruQueryCacheKey?: string }

        if (
          typeof window === "undefined" &&
          renderMode.current === "stream" &&
          promiseId.startsWith("k:") &&
          speculativeStreamPromiseCollector
        ) {
          speculativeStreamPromiseCollector(
            statefulPromise as Kiru.StatefulPromise<unknown>
          )
        }
        devBootstrapTrace("resource:createPromise", {
          path: "cache-short-circuit",
          promiseId,
          cacheKey,
        })
        return statefulPromise
      }
    }

    const newPromise = executeWithTracking({
      fn: () => {
        let promise: Promise<T>
        if (renderMode.current === "string") {
          // if we're rendering to a string, there's no need to fire the callback
          promise = Promise.resolve() as Promise<T>
        } else if (!forceFetch && shouldResolveDeferredPromise(promiseId)) {
          devBootstrapTrace("resource:createPromise", {
            path: "deferred-stream",
            promiseId,
          })
          promise = resolveDeferredPromise<T>(promiseId, signal)
        } else {
          devBootstrapTrace("resource:createPromise", {
            path: "query-fetch",
            promiseId,
            queryAsLoad: !!queryAsLoad,
          })
          // stream / dom / (hydrate + static)
          const ctx: ResourceLoaderContext = { signal }
          const runLoad = async () => {
            if (queryAsLoad) {
              const input =
                source == null
                  ? undefined
                  : unwrapResourceSource(source as ResourceSource)
              return invokeQueryLoad(queryAsLoad, input, ctx.signal)
            }
            if (source == null) {
              return (load as (ctx: ResourceLoaderContext) => Promise<T>)(ctx)
            }
            return (
              load as (
                source: UnwrapResourceSource<ResourceSource>,
                ctx: ResourceLoaderContext
              ) => Promise<T>
            )(unwrapResourceSource(source), ctx)
          }
          const executeLoad = () => runWithRemoteAbortSignalAsync(signal, runLoad)

          if (isBrowser) {
            const input =
              source == null
                ? undefined
                : unwrapResourceSource(source as ResourceSource)
            if (queryAsLoad) {
              const { observed, promise: loadPromise } =
                invokeQueryLoadWithObservation(queryAsLoad, input, signal)
              promise = loadPromise.then((value) => {
                reconcileQueryCacheKeys(observed, input)
                return value
              })
            } else {
              let loadPromise!: Promise<T>
              const { observed } = captureSyncQueryObservations(() => {
                loadPromise = executeLoad()
              })
              promise = loadPromise.then((value) => {
                reconcileQueryCacheKeys(observed, input)
                return value
              })
            }
          } else {
            promise = executeLoad()
          }
        }
        return promise
      },
      id: Signal.id(data),
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

        if (typeof window === "undefined" && queryAsLoad) {
          const input =
            source == null
              ? undefined
              : unwrapResourceSource(source as ResourceSource)
          ;(
            statefulPromise as Kiru.StatefulPromise<T> & {
              __kiruQueryCacheKey?: string
            }
          ).__kiruQueryCacheKey = buildQueryWireRefId(
            buildQueryCacheKeyForQuery(queryAsLoad, input)
          )
        }

        if (!isCurrentLoad()) return
        data.value = value
        isPending.value = false
        error.value = null
      })
      .catch((e) => {
        statefulPromise.state = "rejected"
        statefulPromise.error = e instanceof Error ? e : new Error(e)

        if (!isCurrentLoad()) return
        error.value = statefulPromise.error
        isPending.value = false
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

type StreamedPayload = {
  data?: unknown
  error?: string
}

function consumeStreamedPayload<T>(
  streamId: string,
  deferralCache: Map<string, StreamedPayload>,
  announced: Set<string> | undefined,
  resolve: (value: T) => void,
  reject: (reason: Error) => void
): boolean {
  const existing = deferralCache.get(streamId)
  if (!existing) return false

  const resolved = resolveStreamRefPayload(existing)
  if (!resolved) return false

  deferralCache.delete(streamId)
  announced?.delete(streamId)

  const { data, error } = resolved
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
      return
    }

    if (announced) {
      for (const streamId of announced) {
        if (
          !isRelevantStreamId(id, streamId) &&
          !(isInitialSsrStreamPending() && deferralCache.has(streamId))
        ) {
          continue
        }
        if (
          consumeStreamedPayload(
            streamId,
            deferralCache,
            announced,
            resolve,
            reject
          )
        ) {
          return
        }
      }
    }

    const onDataEvent = (event: Event) => {
      const { detail } = event as CustomEvent<DeferredPromiseEventDetail<T>>
      const streamId = detail.id
      const cacheHasStream =
        isInitialSsrStreamPending() && deferralCache.has(streamId)
      if (!isRelevantStreamId(id, streamId) && !cacheHasStream) return
      window.removeEventListener(STREAMED_DATA_EVENT, onDataEvent)

      if (
        consumeStreamedPayload(
          streamId,
          deferralCache,
          announced,
          resolve,
          reject
        )
      ) {
        return
      }

      announced?.delete(streamId)
      const resolved = resolveStreamRefPayload(detail)
      if (!resolved) return reject(new Error("Unresolved streamed data ref"))
      if (resolved.error) return reject(new Error(resolved.error))
      resolve(resolved.data as T)
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
    Signal.isSignal(thing) &&
    "promise" in thing &&
    thing["promise"] instanceof Promise
  )
}

function unwrapResourceSource<T extends ResourceSource>(
  source: T
): UnwrapResourceSource<T> {
  if (Signal.isSignal(source)) {
    return source.peek() as UnwrapResourceSource<T>
  }
  const out: Record<string, unknown> = {}
  for (const key in source) {
    if (Signal.isSignal(source[key])) {
      out[key] = source[key].peek()
    }
  }
  return out as UnwrapResourceSource<T>
}
