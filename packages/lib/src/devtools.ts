import type { DebuggerEntry } from "./globalContext.js"

export namespace DevTools {
  export const track = (signal: Kiru.Signal<unknown>, label?: string) => {
    if (!("window" in globalThis)) return
    window.__kiru.devtools?.track(signal, label)
  }
  export const untrack = (signal: Kiru.Signal<unknown>) => {
    if (!("window" in globalThis)) return
    window.__kiru.devtools?.untrack(signal)
  }
  export const subscribe = (
    callback: (entries: Set<DebuggerEntry>) => void
  ) => {
    if (!("window" in globalThis) || !window.__kiru.devtools) return () => {}
    return window.__kiru.devtools.subscribe(callback)
  }
}
