import { __DEV__ } from "./env.js"
import { useHook } from "./hooks/utils.js"
import { Signal } from "./signals/base.js"
import { AsyncTaskState } from "./types.utils.js"
import {
  deepCompare,
  noop,
  safeStringify,
  shallowCompare,
  sideEffectsEnabled,
} from "./utils/index.js"

export type UseSWRState<T> = AsyncTaskState<T, UseSWRError> & {
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

export interface SWRCacheEntry<T> {
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

export type SWRCache = Map<string, SWRCacheEntry<any>>

export interface SWROptions {
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

type SWRHook = Kiru.Hook<{
  strKey: string
  options: SWROptions
  update: () => void
}>

type SWRTupleKey = readonly [any, ...unknown[]]
export type SWRKey =
  | string
  | SWRTupleKey
  | Record<any, any>
  | null
  | undefined
  | false

const SWRGlobalState = {
  cache: null as any as SWRCache,
  online: false,
}

if ("window" in globalThis) {
  if (__DEV__) {
    SWRGlobalState.cache = window.__kiru!.SWRGlobalCache ??= new Map()
  } else {
    SWRGlobalState.cache = new Map()
  }

  SWRGlobalState.online = navigator.onLine
  window.addEventListener("online", () => {
    SWRGlobalState.online = true
  })
  window.addEventListener("offline", () => {
    SWRGlobalState.online = false
  })

  let blurStart: number | null = null
  window.addEventListener("blur", () => {
    blurStart = Date.now()
  })
  window.addEventListener("focus", () => {
    const blurDuration = blurStart ? Date.now() - blurStart : 0
    blurStart = null
    if (blurDuration < 3_000) return // only trigger revalidation after 3 seconds

    SWRGlobalState.cache.forEach((entry) => {
      if (
        entry.subscribers.size === 0 ||
        entry.options.revalidateOnFocus === false ||
        (entry.options.refetchWhenOffline === false &&
          SWRGlobalState.online === false)
      ) {
        return
      }

      entry.isValidating.value = true
      performFetch(entry, () => {
        entry.isValidating.value = false
      })
    })
  })
}

function createSWRCacheEntry<T, K extends SWRKey>(
  key: K,
  fetcher: (args: K) => Promise<T>
) {
  return {
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
  } satisfies SWRCacheEntry<T>
}

export function preloadSWR<T>(
  key: SWRKey,
  fetcher: (args: SWRKey) => Promise<T>
) {
  if (!("window" in globalThis)) return

  const strKey = safeStringify(key, { functions: false })
  if (!SWRGlobalState.cache.has(strKey)) {
    const entry = createSWRCacheEntry(key, fetcher)
    SWRGlobalState.cache.set(strKey, entry)
    performFetch(entry)
  }
}

export function getSWRState<T>(key: SWRKey): SWRCacheEntry<T> | null {
  const strKey = safeStringify(key, { functions: false })
  return SWRGlobalState.cache.get(strKey) ?? null
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
    ({ hook, isInit, isHMR, update }) => {
      if (__DEV__) {
        if (isInit) {
          hook.dev = {
            devtools: {
              get: () => ({
                key: hook.strKey,
                value: SWRGlobalState.cache.get(strKey)!,
              }),
            },
            initialArgs: [key, options],
          }
        }
        if (isHMR) {
          const entry = SWRGlobalState.cache.get(hook.strKey)
          const [k, o] = hook.dev!.initialArgs
          hook.dev!.initialArgs = [key, options]

          if (entry) {
            if (!shallowCompare(k, key)) {
              // if key changed, new entry will be created
            } else if (
              entry.fetcher !== fetcher ||
              !shallowCompare(o, options)
            ) {
              entry.fetcher = fetcher
              entry.options = options
              clearTimeout(entry.refreshInterval)
              clearTimeout(entry.retryState?.timeout)
              performFetch(entry)
            }
          }
        }
      }
      hook.options = options
      const strKey = safeStringify(key, { functions: false })
      let entry: SWRCacheEntry<T>
      if (isInit || strKey !== hook.strKey) {
        if (strKey !== hook.strKey) {
          hook.cleanup?.()
        }
        hook.strKey = strKey
        hook.update = update

        let isNewEntry = false
        if (!SWRGlobalState.cache.has(strKey)) {
          isNewEntry = true
          entry = createSWRCacheEntry(key, fetcher)
          SWRGlobalState.cache.set(strKey, entry)

          entry.resource.subscribe(() => {
            entry.subscribers.forEach((sub) => sub.update())
          })

          performFetch(entry)
        }

        entry ??= SWRGlobalState.cache.get(strKey)!
        const subs = entry.subscribers
        if (subs.size === 0) {
          if (!isNewEntry) {
            entry.isValidating.value = true
            performFetch(entry, () => {
              entry.isValidating.value = false
            })
          }

          entry.options = options
          if (options.refreshInterval) {
            entry.refreshInterval = window.setInterval(() => {
              if (entry.subscribers.size === 0) return
              performFetch(entry)
            }, options.refreshInterval)
          }
        }
        subs.add(hook)
        hook.cleanup = () => {
          subs.delete(hook)
          if (entry.subscribers.size === 0) {
            window.clearInterval(entry.refreshInterval)
            window.clearTimeout(entry.retryState?.timeout)
          }
        }
      }

      entry ??= SWRGlobalState.cache.get(strKey)!
      const { resource, isMutating, isValidating } = entry
      const { data, loading, error } = resource.peek()

      const mutate: UseSWRState<T>["mutate"] = (callback) => {
        isMutating.value = true
        callback()
          .then((data) => {
            if (entry.retryState) {
              window.clearTimeout(entry.retryState.timeout)
              entry.retryState = null
              entry.isValidating.value = false
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

function performFetch<T>(entry: SWRCacheEntry<T>, onSuccess?: () => void) {
  entry.fetcher(entry.key).then(
    (data) => {
      if (entry.retryState) {
        window.clearTimeout(entry.retryState.timeout)
        entry.retryState = null
      }
      const prev = entry.resource.peek().data
      if (!deepCompare(prev, data)) {
        entry.resource.value = {
          data,
          loading: false,
          error: null,
        }
      }

      onSuccess?.()
    },
    (error) => {
      entry.resource.value = {
        data: null,
        loading: false,
        error: new UseSWRError(error),
      }
      const retryState: SWRRetryState = (entry.retryState ??= {
        count: 0,
        timeout: 0,
        delay: 250,
      })
      if (retryState.count >= (entry.options.maxRetryCount ?? Infinity)) {
        return
      }

      retryState.timeout = window.setTimeout(() => {
        retryState.count++
        retryState.delay *= 2
        performFetch(entry, onSuccess)
      }, entry.retryState.delay)
    }
  )
}
