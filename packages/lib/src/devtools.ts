import type { DebuggerEntry } from "./globalContext"

export namespace Devtools {
  export const track = (signal: Kiru.Signal<unknown>, label?: string) => {
    window.__kiru.devtools?.track(signal, label)
  }
  export const untrack = (signal: Kiru.Signal<unknown>) => {
    window.__kiru.devtools?.untrack(signal)
  }
  export const subscribe = (
    callback: (entries: Set<DebuggerEntry>) => void
  ) => {
    if (!window.__kiru.devtools) return () => {}
    return window.__kiru.devtools?.subscribe(callback)
  }
}
