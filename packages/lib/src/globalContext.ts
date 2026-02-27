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
    debugger: {
      add: (signal: Kiru.Signal<any>) => void
      remove: (signal: Kiru.Signal<any>) => void
      subscribe: (
        callback: (signals: Set<Kiru.Signal<any>>) => void
      ) => () => void
    }
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

    const trackedSignals = new Set<Kiru.Signal<any>>()
    const subscribers = new Set<
      (trackedSignals: Set<Kiru.Signal<any>>) => void
    >()

    globalContext.devtools = {
      debugger: {
        add: (signal: Kiru.Signal<any>) => {
          trackedSignals.add(signal)
          subscribers.forEach((cb) => cb(trackedSignals))
        },
        remove: (signal: Kiru.Signal<any>) => {
          trackedSignals.delete(signal)
          subscribers.forEach((cb) => cb(trackedSignals))
        },
        subscribe: (cb: (trackedSignals: Set<Kiru.Signal<any>>) => void) => {
          subscribers.add(cb)
          cb(trackedSignals)
          return () => subscribers.delete(cb)
        },
      },
    }
  }

  return globalContext
}
