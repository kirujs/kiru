import { $HMR_ACCEPT, STREAMED_DATA_EVENT } from "./constants.js"
import { hydrationMode, node, renderMode } from "./globals.js"
import { Signal, signal } from "./signals/base.js"
import { executeWithTracking } from "./signals/tracking.js"
import { createStableId, registerCleanup } from "./utils/node.js"
import { generateRandomID } from "./utils/generateId.js"
import { __DEV__, isBrowser } from "./env.js"
import { GenericHMRAcceptor, performHmrAccept } from "./hmr.js"

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

export type Resource<T> = Kiru.Signal<T> & ResourceState<T>
export interface ResourceLoaderContext {
  signal: AbortSignal
}

const resourceMeta = new WeakMap<Kiru.KiruNode, { id: string; index: number }>()

export function resource<T>(
  callback: (ctx: ResourceLoaderContext) => Promise<T>
): Resource<T>
export function resource<T, Source extends ResourceSource>(
  source: Source,
  callback: (
    source: UnwrapResourceSource<Source>,
    ctx: ResourceLoaderContext
  ) => Promise<T>
): Resource<T>
export function resource<T, Source extends ResourceSource>(
  callbackOrSource: Source | ((ctx: ResourceLoaderContext) => Promise<T>),
  callback?: (
    source: UnwrapResourceSource<Source>,
    ctx: ResourceLoaderContext
  ) => Promise<T>
): Resource<T> {
  const data = signal(void 0 as T)
  const error = signal<Error | null>(null)
  const isPending = signal(true)

  let controller = new AbortController()

  let promiseId = ""
  const owner = node.current
  if (!owner) {
    // todo: investigate streaming global resources via SSR
    // likely cooked since we can't ensure modules are loaded in the same order,
  } else if (
    renderMode.current === "hydrate" ||
    renderMode.current === "stream"
  ) {
    // hydrate or stream - create a deterministic id + index offset to use for promise hydration
    const { id, index } = resourceMeta.get(owner) ?? {
      id: createStableId(owner),
      index: 0,
    }
    promiseId = `${id}:resource:${index}`
    resourceMeta.set(owner, { id, index: index + 1 })
  } else {
    // could be improved. For now, just use a random id to prevent collisions on the cleanups map.
    // in future, we could implement a cached id based on the owner node for use across other modules too.
    promiseId = generateRandomID()
  }

  const updateResource = () => {
    resource.promise = createPromise()
    resource.notify()
  }

  let unsubFromSource: (() => void) | undefined
  if (typeof callbackOrSource === "object") {
    if (Signal.isSignal(callbackOrSource)) {
      unsubFromSource = callbackOrSource.subscribe(updateResource)
    } else {
      const unsubs: (() => void)[] = []
      for (const key in callbackOrSource) {
        if (!Signal.isSignal(callbackOrSource[key])) continue
        unsubs.push(callbackOrSource[key].subscribe(updateResource))
      }
      unsubFromSource = () => {
        unsubs.forEach((unsub) => unsub())
      }
    }
  }

  const observedSignalUnsubs = new Map<string, () => void>()
  const dispose = () => {
    if (!controller.signal.aborted) controller.abort()
    Signal.dispose(data)
    Signal.dispose(isPending)
    observedSignalUnsubs.forEach((unsub) => unsub())
    unsubFromSource?.()
  }

  if (owner) {
    registerCleanup(owner, promiseId, dispose)
  }

  let promise: Kiru.StatefulPromise<T>
  const resource: Resource<T> = Object.assign(data, {
    error,
    isPending,
    get promise() {
      return (promise ??= createPromise())
    },
    set promise(newPromise) {
      promise = newPromise
    },
    refetch() {
      data.value = void 0 as T
      resource.promise = createPromise()
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
        controller.abort()
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

  function createPromise(): Kiru.StatefulPromise<T> {
    controller.abort()
    const ctrl = (controller = new AbortController())
    isPending.value = true
    const newPromise = executeWithTracking({
      fn: () => {
        let promise: Promise<T>
        if (renderMode.current === "string") {
          // if we're rendering to a string, there's no need to fire the callback
          promise = Promise.resolve() as Promise<T>
        } else if (
          renderMode.current === "hydrate" &&
          hydrationMode.current === "dynamic"
        ) {
          // if we're hydrating and the hydration mode is not static,
          // we need to resolve the promise from cache/event
          promise = resolveDeferredPromise<T>(promiseId, ctrl.signal)
        } else {
          // stream / dom / (hydrate + static)
          if (typeof callbackOrSource === "function") {
            promise = callbackOrSource({ signal: ctrl.signal })
          } else {
            const source = unwrapResourceSource(callbackOrSource)
            promise = callback!(source, { signal: ctrl.signal })
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

    statefulPromise
      .then((value) => {
        statefulPromise.state = "fulfilled"
        statefulPromise.value = value

        if (ctrl !== controller) return
        data.value = value
        isPending.value = false
        error.value = null
      })
      .catch((e) => {
        statefulPromise.state = "rejected"
        statefulPromise.error = e instanceof Error ? e : new Error(e)

        if (ctrl !== controller) return
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

  return resource
}

interface DeferredPromiseEventDetail<T> {
  id: string
  data?: T
  error?: string
}

function resolveDeferredPromise<T>(
  id: string,
  signal: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const deferralCache: Map<string, { data?: T; error?: string }> = // @ts-ignore
      (window[STREAMED_DATA_EVENT] ??= new Map())

    const existing = deferralCache.get(id)
    if (existing) {
      const { data, error } = existing
      deferralCache.delete(id)
      if (error) return reject(error)
      return resolve(data!)
    }

    const onDataEvent = (event: Event) => {
      const { detail } = event as CustomEvent<DeferredPromiseEventDetail<T>>
      if (detail.id === id) {
        deferralCache.delete(id)
        window.removeEventListener(STREAMED_DATA_EVENT, onDataEvent)
        const { data, error } = detail
        if (error) return reject(error)
        resolve(data!)
      }
    }

    window.addEventListener(STREAMED_DATA_EVENT, onDataEvent)
    signal.addEventListener("abort", () => {
      window.removeEventListener(STREAMED_DATA_EVENT, onDataEvent)
      reject()
    })
  })
}

/**
 * Returns true if the value is a {@link Resource}
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
