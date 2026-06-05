import { __DEV__ } from "../env.js"

/** Push to `window.__kiruBootstrapTrace` when e2e diagnostics are installed. */
export function devBootstrapTrace(event: string, detail?: unknown): void {
  if (!__DEV__) return
  if (typeof window === "undefined") return
  const trace = (
    window as {
      __kiruBootstrapTrace?: Array<{
        t: number
        event: string
        detail?: unknown
      }>
    }
  ).__kiruBootstrapTrace
  if (Array.isArray(trace)) {
    trace.push({ t: performance.now(), event, detail })
  }
}
