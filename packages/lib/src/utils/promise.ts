import { $STREAM_DATA, STREAMED_DATA_EVENT } from "../constants.js"

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
 * Returns true if the value is a {@link Kiru.StatefulPromise}
 */
export function isStatefulPromise(
  thing: unknown
): thing is Kiru.StatefulPromise<unknown> {
  return thing instanceof Promise && "id" in thing && "state" in thing
}

export function createStatefulPromise<T, U extends Record<string, unknown>>(
  id: string,
  promise: Promise<T>,
  extra: U = {} as U
): Kiru.StatefulPromise<T> & U {
  const state: Kiru.PromiseState<T> = { id, state: "pending" }
  const p = Object.assign(promise, state, extra)
  p.then((value) => {
    p.state = "fulfilled"
    p.value = value
  }).catch((error) => {
    p.state = "rejected"
    p.error = error instanceof Error ? error : new Error(error)
  })

  return p
}

interface StreamedPromiseEventDetail<T> {
  id: string
  data?: T
  error?: string
}

export async function resolveStreamedPromise<T>(
  id: string,
  signal?: AbortSignal
): Promise<T> {
  const deferralCache: Map<string, { data?: T; error?: string }> = // @ts-ignore
    (window[STREAMED_DATA_EVENT] ??= new Map())

  const existing = deferralCache.get(id)
  if (existing) {
    deferralCache.delete(id)

    const { data, error } = existing
    if (error) {
      return Promise.reject(error)
    }
    return Promise.resolve(data!)
  }

  return new Promise<T>((resolve, reject) => {
    const onDataEvent = (event: Event) => {
      const { detail } = event as CustomEvent<StreamedPromiseEventDetail<T>>
      if (detail.id === id) {
        deferralCache.delete(id)
        window.removeEventListener(STREAMED_DATA_EVENT, onDataEvent)

        const { data, error } = detail
        if (error) {
          return reject(error)
        }
        resolve(data!)
      }
    }

    window.addEventListener(STREAMED_DATA_EVENT, onDataEvent)
    signal?.addEventListener("abort", () => {
      window.removeEventListener(STREAMED_DATA_EVENT, onDataEvent)
      reject("aborted")
    })
  })
}
