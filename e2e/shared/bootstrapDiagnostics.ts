export type BootstrapTraceEntry = {
  t: number
  event: string
  detail?: unknown
}

declare global {
  interface Window {
    __kiruBootstrapTrace?: BootstrapTraceEntry[]
    __kiruAppWiped?: boolean
    __kiruBootstrapSnapshot?: {
      childElementCount: number
      innerHTMLLength: number
    }
  }
}

function pushTrace(event: string, detail?: unknown): void {
  const trace = (window.__kiruBootstrapTrace ??= [])
  trace.push({ t: performance.now(), event, detail })
}

function snapshotApp(container: HTMLElement) {
  return {
    childElementCount: container.childElementCount,
    innerHTMLLength: container.innerHTML.length,
  }
}

/** Install wipe/error tracing before SSR client bootstrap. */
export function installBootstrapDiagnostics(container: HTMLElement): void {
  window.__kiruBootstrapTrace = []
  window.__kiruAppWiped = false

  pushTrace("diagnostics:install", snapshotApp(container))

  const observer = new MutationObserver(() => {
    const snap = snapshotApp(container)
    if (snap.childElementCount === 0 && snap.innerHTMLLength < 20) {
      pushTrace("mutation:empty", snap)
      window.__kiruAppWiped = true
    } else {
      pushTrace("mutation:change", snap)
    }
  })
  observer.observe(container, { childList: true, subtree: true })

  window.addEventListener("error", (event) => {
    pushTrace("window:error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
    })
  })

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason
    pushTrace("unhandledrejection", {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })
}

export function traceBootstrapEvent(event: string, detail?: unknown): void {
  pushTrace(event, detail)
}

export function finalizeBootstrapDiagnostics(container: HTMLElement): void {
  const snap = snapshotApp(container)
  window.__kiruBootstrapSnapshot = snap
  window.__kiruAppWiped = snap.childElementCount === 0
  pushTrace("bootstrap:finalize", snap)
}
