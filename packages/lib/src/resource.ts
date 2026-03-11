import { $HMR_ACCEPT, STREAMED_DATA_EVENT } from "./constants.js"
import { hydrationMode, node, renderMode } from "./globals.js"
import { Signal, signal } from "./signals/base.js"
import { createVNodeId, registerVNodeCleanup } from "./utils/vdom.js"
import { generateRandomID } from "./utils/generateId.js"
import { __DEV__, isBrowser } from "./env.js"
import { GenericHMRAcceptor, performHmrAccept } from "./hmr.js"

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

const resourceMeta = new WeakMap<Kiru.VNode, { id: string; index: number }>()

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

export function resource<T, Source>(
  source: Kiru.Signal<Source>,
  callback: (source: Source, ctx: ResourceLoaderContext) => Promise<T>
): Resource<T> {
  const data = signal(void 0 as T)
  const error = signal<Error | null>(null)
  const isPending = signal(true)

  let promiseId = ""
  const vNode = node.current
  if (!vNode) {
    // todo: investigate streaming global resources via SSR
    // likely cooked since we can't ensure modules are loaded in the same order,
  } else if (
    renderMode.current === "hydrate" ||
    renderMode.current === "stream"
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

  const unsub = source.subscribe((src) => {
    resource.promise = createPromise(src)
    resource.notify()
  })

  let controller = new AbortController()
  const dispose = () => {
    if (!controller.signal.aborted) controller.abort()
    Signal.dispose(data)
    Signal.dispose(isPending)
    unsub()
  }

  if (vNode) {
    registerVNodeCleanup(vNode, promiseId, dispose)
  }

  const resource: Resource<T> = Object.assign(data, {
    error,
    isPending,
    promise: undefined as unknown as Kiru.StatefulPromise<T>,
    refetch() {
      data.value = void 0 as T
      this.promise = createPromise(source.peek())
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

  if (__DEV__ && isBrowser && window.__kiru.HMRContext?.isReplacement()) {
    queueMicrotask(() => {
      resource.promise = createPromise(source.peek())
    })
  } else {
    resource.promise = createPromise(source.peek())
  }

  function createPromise(source: Source): Kiru.StatefulPromise<T> {
    controller.abort()
    const ctrl = (controller = new AbortController())
    isPending.value = true
    let newPromise: Promise<T>
    if (renderMode.current === "string") {
      // if we're rendering to a string, there's no need to fire the callback
      newPromise = Promise.resolve() as Promise<T>
    } else if (
      renderMode.current === "hydrate" &&
      hydrationMode.current === "dynamic"
    ) {
      // if we're hydrating and the hydration mode is not static,
      // we need to resolve the promise from cache/event
      newPromise = resolveDeferredPromise<T>(promiseId, ctrl.signal)
    } else {
      // stream / dom / (hydrate + static)
      newPromise = callback(source, { signal: ctrl.signal })
    }

    const statefulPromise: Kiru.StatefulPromise<T> = Object.assign(newPromise, {
      id: promiseId,
      state: "pending",
    } satisfies Kiru.PromiseState<T>)

    statefulPromise
      .then((value) => {
        statefulPromise.state = "fulfilled"
        statefulPromise.value = value
        data.value = value
        isPending.value = false
        error.value = null
      })
      .catch((e) => {
        if (ctrl !== controller) return // prevent setting pending=false if new controller was recreated (new promise)
        statefulPromise.state = "rejected"
        statefulPromise.error = e instanceof Error ? e : new Error(e)
        error.value = statefulPromise.error
        isPending.value = false
      })
    return statefulPromise
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
