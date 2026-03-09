import { $STREAM_DATA, STREAMED_DATA_EVENT } from "./constants.js"
import { hydrationMode, node, renderMode } from "./globals.js"
import { Signal, signal } from "./signals/base.js"
import { createVNodeId, registerVNodeCleanup } from "./utils/vdom.js"
import { generateRandomID } from "./utils/generateId.js"
import { tracking, TrackingStackObservations } from "./signals/tracking.js"

export interface StreamDataThrowValue {
  [$STREAM_DATA]: {
    fallback?: JSX.Element
    data: Kiru.StatefulPromise<unknown>[]
  }
}

/**
 * Returns true if the value is a {@link StreamDataThrowValue}
 */
export function isStreamDataThrowValue(
  value: unknown
): value is StreamDataThrowValue {
  return typeof value === "object" && !!value && $STREAM_DATA in value
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

const nodeToPromiseIndex = new WeakMap<Kiru.VNode, number>()

interface ResourceState<T> {
  state: "fulfilled" | "pending" | "rejected"
  error: Signal<Error | null>
  isPending: Signal<boolean>
  promise: Kiru.StatefulPromise<T>
  id: string
  refetch: () => void
  dispose: () => void
}

type Resource<T> = Kiru.Signal<T> & ResourceState<T>

export function resource<T>(
  callback: (signal: AbortSignal) => Promise<T>
): Resource<T> {
  const data = signal(void 0 as T)
  const error = signal<Error | null>(null)
  const isPending = signal(true)
  const observedSignals: TrackingStackObservations = new Map()
  const cleanups: Record<string, () => void> = {}

  let promiseId: string
  const vNode = node.current
  if (!vNode) {
    promiseId = `global:resource:${generateRandomID()}`
  } else {
    const index = nodeToPromiseIndex.get(vNode) ?? 0
    nodeToPromiseIndex.set(vNode, index + 1)
    promiseId = `${createVNodeId(vNode)}:resource:${index}`
  }

  let controller = new AbortController()
  const dispose = () => {
    controller.signal.aborted || controller.abort()
    Signal.dispose(data)
    Signal.dispose(isPending)
    Object.values(cleanups).forEach((c) => c())
  }

  if (vNode) {
    registerVNodeCleanup(vNode, promiseId, dispose)
  }

  const resource: Resource<T> = Object.assign(data, {
    error,
    isPending,
    get state() {
      return this.promise.state
    },
    promise: createPromise(),
    id: promiseId,
    refetch() {
      data.value = void 0 as T
      this.promise = createPromise()
    },
    dispose,
  })

  function createPromise(): Kiru.StatefulPromise<T> {
    controller.abort()
    controller = new AbortController()
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
      newPromise = resolveDeferredPromise<T>(promiseId, controller.signal)
    } else {
      // dom / stream / (hydrate + static)
      observedSignals.clear()
      tracking.stack.push(observedSignals)
      newPromise = callback(controller.signal)
      tracking.stack.pop()

      observedSignals.forEach((sig, id) => {
        if (id in cleanups) return
        cleanups[id] = sig.subscribe(() => {
          resource.promise = createPromise()
          data.notify()
        })
      })
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
      })
      .catch((error) => {
        statefulPromise.state = "rejected"
        statefulPromise.error =
          error instanceof Error ? error : new Error(error)
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
