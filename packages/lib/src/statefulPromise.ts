import { $STREAM_DATA, STREAMED_DATA_EVENT } from "./constants.js"
import { hydrationMode, node, renderMode } from "./globals.js"
import { Signal, signal } from "./signals/base.js"
import { getVNodeId } from "./utils/vdom.js"
import { onCleanup } from "./hooks/onCleanup.js"

export interface StreamDataThrowValue {
  [$STREAM_DATA]: {
    fallback?: JSX.Element
    data: Kiru.StatefulPromiseBase<unknown>[]
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
 * Returns true if the value is a {@link Kiru.StatefulPromiseBase}
 */
export function isStatefulPromise(
  thing: unknown
): thing is Kiru.StatefulPromiseBase<unknown> {
  return thing instanceof Promise && "id" in thing && "state" in thing
}

const nodeToPromiseIndex = new WeakMap<Kiru.VNode, number>()

type StatefulPromise<T> = Kiru.StatefulPromiseBase<T> & {
  isPending: Signal<boolean>
}

export function statefulPromise<T>(
  callback: (signal: AbortSignal) => Promise<T>
): StatefulPromise<T> {
  const vNode = node.current!
  if (!vNode) {
    throw new Error("statefulPromise must be called inside a Kiru component")
  }
  const id = getVNodeId(vNode)
  const isPending = signal(true)

  isPending.value = true

  const controller = new AbortController()
  onCleanup(() => controller.abort())

  const index = nodeToPromiseIndex.get(vNode) ?? 0
  nodeToPromiseIndex.set(vNode, index + 1)

  const promiseId = `${id}:data:${index}`

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
    promise = resolveDeferredPromise<T>(promiseId, controller.signal)
  } else {
    // dom / stream / (hydrate + static)
    promise = callback(controller.signal)
  }

  const state: Kiru.PromiseState<T> = {
    id: promiseId,
    state: "pending",
  }
  const statefulPromise: Kiru.StatefulPromiseBase<T> = Object.assign(
    promise,
    state
  )

  statefulPromise
    .then((value) => {
      statefulPromise.state = "fulfilled"
      statefulPromise.value = value
      isPending.value = false
    })
    .catch((error) => {
      statefulPromise.state = "rejected"
      statefulPromise.error = error instanceof Error ? error : new Error(error)
    })

  return Object.assign(statefulPromise, { isPending })
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
