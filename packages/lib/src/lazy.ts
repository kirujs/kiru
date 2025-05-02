import { $HMR_ACCEPT } from "./constants.js"
import { createElement } from "./element.js"
import { __DEV__ } from "./env.js"
import { renderMode } from "./globals.js"
import { HMRAccept } from "./hmr.js"
import { useRequestUpdate } from "./hooks/utils.js"
import { traverseApply } from "./utils.js"

type FCModule = { default: Kaioken.FC<any> }
type LazyImportValue = Kaioken.FC<any> | FCModule
type InferLazyImportProps<T extends LazyImportValue> = T extends FCModule
  ? Kaioken.InferProps<T["default"]>
  : Kaioken.InferProps<T>

type LazyState = {
  promise: Promise<LazyImportValue>
  result: Kaioken.FC | null
}

type LazyComponentProps<T extends LazyImportValue> = InferLazyImportProps<T> & {
  fallback?: JSX.Element
}

const lazyCache: Map<string, LazyState> =
  "window" in globalThis
    ? // @ts-ignore - we're shamefully polluting the global scope here and hiding it 🥲
      (window.__KAIOKEN_LAZY_CACHE ??= new Map<string, LazyState>())
    : new Map<string, LazyState>()

export function lazy<T extends LazyImportValue>(
  componentPromiseFn: () => Promise<T>
): Kaioken.FC<LazyComponentProps<T>> {
  function LazyComponent(props: LazyComponentProps<T>) {
    const { fallback = null, ...rest } = props
    const requestUpdate = useRequestUpdate()
    if (renderMode.current === "string" || renderMode.current === "stream") {
      return fallback
    }

    const asStr = cleanFnStr(componentPromiseFn.toString())
    const cachedState = lazyCache.get(asStr)

    if (!cachedState) {
      const promise = componentPromiseFn()
      const state: LazyState = {
        promise,
        result: null,
      }
      lazyCache.set(asStr, state)
      promise.then((componentOrModule) => {
        state.result =
          typeof componentOrModule === "function"
            ? componentOrModule
            : componentOrModule.default
        requestUpdate()
      })
      return fallback
    }

    if (cachedState.result === null) {
      cachedState.promise.then(requestUpdate)
      return fallback
    }
    if (__DEV__) {
      return createElement(cachedState.result, rest)
    }
    return createElement(cachedState.result, rest)
  }
  LazyComponent.displayName = "Kaioken.lazy"
  if (__DEV__) {
    return Object.assign(LazyComponent, {
      [$HMR_ACCEPT]: {
        inject: (prev) => {
          window.__kaioken!.apps.forEach((ctx) => {
            if (!ctx.mounted || !ctx.rootNode) return
            traverseApply(ctx.rootNode, (vNode) => {
              if (vNode.type === prev) {
                vNode.type = LazyComponent
                vNode.hmrUpdated = true
                if (vNode.prev) {
                  vNode.prev.type = LazyComponent
                }
                ctx.requestUpdate(vNode)
              }
            })
          })
        },
        destroy: () => {},
        provide: () => LazyComponent,
      } satisfies HMRAccept<Function>,
    })
  }
  return LazyComponent
}

const cleanFnStr = (fnStr: string) => fnStr.replace(/\?[^"]*/, "")
