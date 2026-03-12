import { createElement } from "../element.js"
import { __DEV__, isBrowser } from "../env.js"
import { sideEffectsEnabled } from "../utils/runtime.js"
import { node } from "../globals.js"
import { requestUpdate } from "../scheduler.js"

interface FCModule {
  default: Kiru.FC<any>
}

type LazyImportValue = Kiru.FC<any> | FCModule

type InferLazyImportProps<T extends LazyImportValue> = T extends FCModule
  ? Kiru.InferProps<T["default"]>
  : Kiru.InferProps<T>

interface LazyState {
  promise: Promise<LazyImportValue>
  result: Kiru.FC | null
  error?: Error
}

type LazyComponentProps<T extends LazyImportValue> = InferLazyImportProps<T> & {
  fallback?: JSX.Element
}

const lazyCache: Map<string, LazyState> = isBrowser
  ? // @ts-ignore - we're shamefully polluting the global scope here and hiding it 🥲
    (window.__KIRU_LAZY_CACHE ??= new Map<string, LazyState>())
  : new Map<string, LazyState>()

/**
 * Lazy loads a component and renders it when it is ready.
 * @see https://kirujs.dev/docs/components/lazy
 */
export function lazy<T extends LazyImportValue>(
  componentPromiseFn: () => Promise<T>
): Kiru.FC<LazyComponentProps<T>> {
  function LazyWrapper(props: LazyComponentProps<T>) {
    const { fallback = null, ...rest } = props
    const nodeRef = node.current!
    if (!sideEffectsEnabled()) {
      return fallback
    }

    const fn = removeQueryString(componentPromiseFn.toString())
    const cachedState = lazyCache.get(fn)

    if (!cachedState) {
      const promise = new Promise<T>((r) => r(componentPromiseFn()))
      const state: LazyState = {
        promise,
        result: null,
      }
      lazyCache.set(fn, state)
      promise
        .then((componentOrModule) => {
          state.result =
            typeof componentOrModule === "function"
              ? componentOrModule
              : componentOrModule.default
        })
        .catch((e) => {
          state.error = e instanceof Error ? e : new Error(String(e))
        })
        .finally(() => requestUpdate(nodeRef))
      return fallback
    }

    const { error, result, promise } = cachedState

    if (error) {
      throw error
    }
    if (result === null) {
      promise.then(() => requestUpdate(nodeRef))
      return fallback
    }

    return createElement(result, rest)
  }

  if (__DEV__) {
    LazyWrapper.displayName = "Kiru.lazy"
  }
  return LazyWrapper
}

/**
 * removes the query string from a function - prevents
 * vite-modified imports (eg. () => import("./Counter.tsx?t=123456"))
 * from causing issues
 */
const removeQueryString = (fnStr: string): string =>
  fnStr.replace(
    /import\((["'])([^?"']+)\?[^)"']*\1\)/g,
    (_, quote, path) => `import(${quote}${path}${quote})`
  )
