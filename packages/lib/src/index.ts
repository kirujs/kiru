import { __DEV__ } from "./env.js"
import { createKiruGlobalContext } from "./globalContext.js"

export type * from "./types"
export * from "./signals/index.js"
export * from "./action.js"
export * from "./appContext.js"
export * from "./cloneVNode.js"
export * from "./context.js"
export * from "./customEvents.js"
export * from "./element.js"
export * from "./hooks/index.js"
export * from "./lazy.js"
export { memo } from "./memo.js"
export * from "./portal.js"
export * from "./renderToString.js"
export { nextIdle, flushSync, requestUpdate } from "./scheduler.js"
export * from "./store.js"
export * from "./transition.js"

if (__DEV__) {
  if ("window" in globalThis) {
    globalThis.window.__kiru ??= createKiruGlobalContext()
  }
}
