import { useHook } from "./hooks/utils.js"
import { Signal } from "./signals/base.js"
import {
  noop,
  deepCompare,
  safeStringify,
  sideEffectsEnabled,
} from "./utils.js"

export type UseSWRState<T> = (
  | {
      data: null
      error: null
      loading: true
    }
  | {
      data: T
      error: null
      loading: false
    }
  | {
      data: null
      error: UseSWRError
      loading: false
    }
) & {
  mutate: (callback: () => Promise<T>) => void
  isMutating: Signal<boolean>
  isValidating: Signal<boolean>
}

export class UseSWRError extends Error {
  constructor(message: unknown) {
    super(message instanceof Error ? message.message : String(message))
    this.name = "UseSWRError"
    this.cause = message
  }
}

export type SWRResourceState<T> = {
  data: T | null
  loading: boolean
  error: Error | null
}

export type SWRRetryState = {
  count: number
  timeout: number
  delay: number
} | null

export type SWRGlobalStateEntry<T> = {
  key: any
  resource: Signal<SWRResourceState<T>>
  fetcher: (args: any) => Promise<T>
  subscribers: Set<SWRHook>
  isMutating: Signal<boolean>
  isValidating: Signal<boolean>
  retryState: SWRRetryState
  options: SWROptions
  refreshInterval?: number
}

type SWRGlobalState = {
  [key: string]: SWRGlobalStateEntry<any>
}

export type SWROptions = {
  /**
   * Specify `false` to disable revalidation on focus
   */
  revalidateOnFocus?: boolean

  /**
   * Number of times to retry a failed fetch
   * @default Infinity
   */
  maxRetryCount?: number

  /**
   * Enable automatic refetching of stale data every `refreshInterval` milliseconds
   */
  refreshInterval?: number

  /**
   * Enable refetching of stale data when offline - useful for offline-first apps
   */
  refetchWhenOffline?: boolean
}

type SWRHook = Kaioken.Hook<{
  strKey: string
  options: SWROptions
  update: () => void
}>

type SWRTupleKey = readonly [any, ...unknown[]]
type SWRKey = string | SWRTupleKey | Record<any, any> | null | undefined | false

let SWR_GLOBAL: SWRGlobalState
let IS_ONLINE = false

if ("window" in globalThis) {
  SWR_GLOBAL = window.__kaioken!.globalState[Symbol.for("SWR_GLOBAL")] ??= {}

  IS_ONLINE = navigator.onLine
  window.addEventListener("online", () => {
    IS_ONLINE = true
  })
  window.addEventListener("offline", () => {
    IS_ONLINE = false
  })

  let blurStart: number | null = null
  window.addEventListener("blur", () => {
    blurStart = Date.now()
  })
  window.addEventListener("focus", () => {
    const blurDuration = blurStart ? Date.now() - blurStart : 0
    blurStart = null
    if (blurDuration < 3_000) return // only trigger revalidation after 3 seconds

    for (const strKey in SWR_GLOBAL) {
      const state = SWR_GLOBAL[strKey]
      if (
        state.subscribers.size === 0 ||
        state.options.revalidateOnFocus === false ||
        (state.options.refetchWhenOffline === false && IS_ONLINE === false)
      ) {
        continue
      }

      state.isValidating.value = true
      performFetch(state, () => {
        state.isValidating.value = false
      })
    }
  })
}

export function preloadSWR<T>(
  key: SWRKey,
  fetcher: (args: SWRKey) => Promise<T>
) {
  if (!("window" in globalThis)) return

  const strKey = safeStringify(key, { functions: false })
  if (!SWR_GLOBAL[strKey]) {
    const state = (SWR_GLOBAL[strKey] = {
      key,
      resource: new Signal<SWRResourceState<T>>({
        data: null,
        loading: true,
        error: null,
      }),
      fetcher,
      subscribers: new Set(),
      isMutating: new Signal(false),
      isValidating: new Signal(false),
      retryState: null,
      options: {},
    })
    performFetch(state)
  }
}

export function getSWRState<T>(key: SWRKey): SWRGlobalStateEntry<T> | null {
  const strKey = safeStringify(key, { functions: false })
  return SWR_GLOBAL[strKey] ?? null
}

export function useSWR<T, K extends SWRKey>(
  key: K,
  fetcher: (args: K) => Promise<T>,
  options: SWROptions = {}
) {
  if (!sideEffectsEnabled())
    return { data: null, error: null, loading: true } as UseSWRState<T>

  return useHook(
    "useSWR",
    { strKey: "", options, update: noop } satisfies SWRHook,
    ({ hook, isInit, update }) => {
      hook.options = options
      const strKey = safeStringify(key, { functions: false })
      if (isInit || strKey !== hook.strKey) {
        if (strKey !== hook.strKey) {
          hook.cleanup?.()
        }
        hook.strKey = strKey
        hook.update = update

        let isNewEntry = false
        if (!SWR_GLOBAL[strKey]) {
          isNewEntry = true
          const state: SWRGlobalStateEntry<T> = (SWR_GLOBAL[strKey] = {
            key,
            resource: new Signal<SWRResourceState<T>>({
              data: null,
              loading: true,
              error: null,
            }),
            fetcher,
            isMutating: new Signal(false),
            isValidating: new Signal(false),
            subscribers: new Set(),
            retryState: null,
            options: {},
          })

          state.resource.subscribe(() => {
            state.subscribers.forEach((sub) => sub.update())
          })

          performFetch(state)
        }

        const state = SWR_GLOBAL[strKey]
        const subs = state.subscribers
        if (subs.size === 0) {
          if (!isNewEntry) performFetch(SWR_GLOBAL[strKey])

          state.options = options
          if (options.refreshInterval) {
            state.refreshInterval = window.setInterval(() => {
              if (state.subscribers.size === 0) return
              performFetch(state)
            }, options.refreshInterval)
          }
        }
        subs.add(hook)
        hook.cleanup = () => {
          subs.delete(hook)
          if (state.subscribers.size === 0) {
            window.clearInterval(state.refreshInterval)
            window.clearTimeout(state.retryState?.timeout)
          }
        }
      }

      const state = SWR_GLOBAL[strKey] as SWRGlobalStateEntry<T>
      const { resource, isMutating, isValidating } = state
      const { data, loading, error } = resource.peek()

      const mutate: UseSWRState<T>["mutate"] = (callback) => {
        isMutating.value = true
        callback()
          .then((data) => {
            if (state.retryState) {
              window.clearTimeout(state.retryState.timeout)
              state.retryState = null
              state.isValidating.value = false
            }
            const prev = resource.peek().data
            if (deepCompare(prev, data)) return
            resource.value = {
              data,
              loading: false,
              error: null,
            }
          })
          .finally(() => {
            isMutating.value = false
          })
      }

      return {
        data,
        loading,
        error,
        isMutating,
        isValidating,
        mutate,
      } as UseSWRState<T>
    }
  )
}

function performFetch<T>(
  state: SWRGlobalStateEntry<T>,
  onSuccess?: () => void
) {
  state.fetcher(state.key).then(
    (data) => {
      if (state.retryState) {
        window.clearTimeout(state.retryState.timeout)
        state.retryState = null
      }
      const prev = state.resource.peek().data
      if (!deepCompare(prev, data)) {
        state.resource.value = {
          data,
          loading: false,
          error: null,
        }
      }

      onSuccess?.()
    },
    (error) => {
      state.resource.value = {
        data: null,
        loading: false,
        error: new UseSWRError(error),
      }
      const retryState: SWRRetryState = (state.retryState ??= {
        count: 0,
        timeout: 0,
        delay: 250,
      })
      if (retryState.count >= (state.options.maxRetryCount ?? Infinity)) {
        return
      }

      retryState.timeout = window.setTimeout(() => {
        retryState.count++
        retryState.delay *= 2
        performFetch(state, onSuccess)
      }, state.retryState.delay)
    }
  )
}
