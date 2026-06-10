export type OutletDebugEntry = {
  ts: number
  event: string
  data?: Record<string, unknown>
}

const MAX_OUTLET_DEBUG_ENTRIES = 80

declare global {
  interface Window {
    __kiruOutletDebug?: boolean
    __kiruOutletDebugLog?: OutletDebugEntry[]
  }
}

export function isOutletDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  if (window.__kiruOutletDebug) return true
  try {
    return window.localStorage.getItem("kiru-outlet-debug") === "1"
  } catch {
    return false
  }
}

export function enableOutletDebugFromLocation(): void {
  if (typeof window === "undefined") return
  try {
    if (window.localStorage.getItem("kiru-outlet-debug") === "1") {
      window.__kiruOutletDebug = true
    }
  } catch {
    // ignore
  }
}

export function logOutletDebug(
  event: string,
  data?: Record<string, unknown>
): void {
  if (!isOutletDebugEnabled()) return
  const entry: OutletDebugEntry = {
    ts: typeof performance !== "undefined" ? performance.now() : Date.now(),
    event,
    data,
  }
  const log = (window.__kiruOutletDebugLog ??= [])
  log.push(entry)
  if (log.length > MAX_OUTLET_DEBUG_ENTRIES) {
    log.splice(0, log.length - MAX_OUTLET_DEBUG_ENTRIES)
  }
}

export function readOutletDebugLog(): readonly OutletDebugEntry[] {
  if (typeof window === "undefined") return []
  return window.__kiruOutletDebugLog ?? []
}
