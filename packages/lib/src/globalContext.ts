import { __DEV__ } from "./env.js"
import { createHMRContext } from "./hmr.js"
import { createProfilingContext } from "./profiling.js"
import { fileRouterInstance } from "./router/globals.js"
import type { FileRouterController } from "./router/fileRouterController"
import type { AppHandle } from "./appHandle"
import type { requestUpdate } from "./index.js"

export { createKiruGlobalContext, type GlobalKiruEvent, type KiruGlobalContext }

type Evt =
  | {
      name: "mount"
      data?: typeof requestUpdate
    }
  | {
      name: "unmount"
      data?: undefined
    }
  | {
      name: "update"
      data?: undefined
    }
  | {
      name: "error"
      data: Error
    }

type GlobalKiruEvent = Evt["name"]

interface SchedulerInterface {
  requestUpdate: (vNode: Kiru.VNode) => void
}

export type DebuggerEntry = {
  label: string
  signal: Kiru.Signal<unknown>
}

interface KiruGlobalContext {
  readonly apps: AppHandle[]
  emit<T extends Evt>(event: T["name"], app: AppHandle, data?: T["data"]): void
  on<T extends Evt>(
    event: T["name"],
    callback: (app: AppHandle, data: T["data"]) => void
  ): void
  off<T extends Evt>(
    event: T["name"],
    callback: (app: AppHandle, data?: T["data"]) => void
  ): void
  devtools?: {
    track: (signal: Kiru.Signal<unknown>, label?: string) => void
    untrack: (signal: Kiru.Signal<unknown>) => void
    subscribe: (callback: (entries: Set<DebuggerEntry>) => void) => () => void
  }
  HMRContext?: ReturnType<typeof createHMRContext>
  profilingContext?: ReturnType<typeof createProfilingContext>
  fileRouterInstance?: {
    current: FileRouterController | null
  }
  getSchedulerInterface?: (app: AppHandle) => SchedulerInterface | null
}

function createKiruGlobalContext(): KiruGlobalContext {
  const apps = new Set<AppHandle>()
  const appToSchedulerInterface = new WeakMap<AppHandle, SchedulerInterface>()
  const listeners = new Map<
    GlobalKiruEvent,
    Set<(app: AppHandle, data?: Evt["data"]) => void>
  >()
  function emit<T extends Evt>(
    event: T["name"],
    app: AppHandle,
    data?: T["data"]
  ): void {
    listeners.get(event)?.forEach((cb) => cb(app, data))
  }

  function on<T extends Evt>(
    event: T["name"],
    callback: (app: AppHandle, data: T["data"]) => void
  ): void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    listeners.get(event)!.add(callback)
  }

  function off<T extends Evt>(
    event: T["name"],
    callback: (ctx: AppHandle, data?: T["data"]) => void
  ): void {
    listeners.get(event)?.delete(callback)
  }

  const globalContext: KiruGlobalContext = {
    get apps() {
      return Array.from(apps)
    },
    emit,
    on,
    off,
  }

  // Initialize event listeners
  on("mount", (app, requestUpdate) => {
    apps.add(app)
    if (requestUpdate && typeof requestUpdate === "function") {
      appToSchedulerInterface.set(app, { requestUpdate })
    }
  })
  on("unmount", (app) => {
    apps.delete(app)
    appToSchedulerInterface.delete(app)
  })
  if (__DEV__) {
    globalContext.HMRContext = createHMRContext()
    globalContext.profilingContext = createProfilingContext()
    globalContext.fileRouterInstance = fileRouterInstance
    globalContext.getSchedulerInterface = (app) => {
      return appToSchedulerInterface.get(app) ?? null
    }

    const debuggerEntries = new Set<DebuggerEntry>()
    const subscribers = new Set<(debuggerEntries: Set<DebuggerEntry>) => void>()

    globalContext.devtools = {
      track: (signal, label) => {
        debuggerEntries.add({
          label: label ?? signal.displayName ?? "Unnamed Signal",
          signal,
        })
        subscribers.forEach((cb) => cb(debuggerEntries))
      },
      untrack: (signal) => {
        debuggerEntries.forEach((entry) => {
          if (entry.signal === signal) {
            debuggerEntries.delete(entry)
          }
        })
        subscribers.forEach((cb) => cb(debuggerEntries))
      },
      subscribe: (cb) => {
        subscribers.add(cb)
        cb(debuggerEntries)
        return () => subscribers.delete(cb)
      },
    }
  }

  return globalContext
}
