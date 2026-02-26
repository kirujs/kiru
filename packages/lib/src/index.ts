import { createKiruGlobalContext } from "./globalContext.js"

export type * from "./types"
export * from "./signals/index.js"
export * from "./action.js"
export * from "./appHandle.js"
export * from "./components/index.js"
export * from "./context.js"
export * from "./customEvents.js"
export * from "./element.js"
export * from "./error.js"
export * from "./hooks/index.js"
export type { ProfilingEvent, AppStats } from "./profiling.js"
export * from "./renderToString.js"
export * from "./ref.js"
export {
  nextIdle,
  flushSync,
  requestUpdate,
  useRequestUpdate,
} from "./scheduler.js"
export * from "./viewTransitions.js"

// @ts-ignore
if ("window" in globalThis && !globalThis.__KIRU_DEVTOOLS__) {
  globalThis.window.__kiru ??= createKiruGlobalContext()
}
