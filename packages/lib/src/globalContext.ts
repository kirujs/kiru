import { __DEV__ } from "./env.js"
import { createHMRContext } from "./hmr.js"
import { createProfilingContext } from "./profiling.js"
import { fileRouterInstance } from "./router/globals.js"
import type { FileRouterController } from "./router/fileRouterController"
import type { AppContext } from "./appContext"
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
  readonly apps: AppContext[]
  emit<T extends Evt>(event: T["name"], ctx: AppContext, data?: T["data"]): void
  on<T extends Evt>(
    event: T["name"],
    callback: (ctx: AppContext, data: T["data"]) => void
  ): void
  off<T extends Evt>(
    event: T["name"],
    callback: (ctx: AppContext, data?: T["data"]) => void
  ): void
  HMRContext?: ReturnType<typeof createHMRContext>
  profilingContext?: ReturnType<typeof createProfilingContext>
  fileRouterInstance?: {
    current: FileRouterController | null
  }
  getSchedulerInterface?: (app: AppContext) => SchedulerInterface | null
}

function createKiruGlobalContext(): KiruGlobalContext {
  const contexts = new Set<AppContext>()
  const contextToSchedulerInterface = new WeakMap<
    AppContext,
    SchedulerInterface
  >()
  const listeners = new Map<
    GlobalKiruEvent,
    Set<(ctx: AppContext, data?: Evt["data"]) => void>
  >()
  function emit<T extends Evt>(
    event: T["name"],
    ctx: AppContext,
    data?: T["data"]
  ): void {
    listeners.get(event)?.forEach((cb) => cb(ctx, data))
  }

  function on<T extends Evt>(
    event: T["name"],
    callback: (ctx: AppContext, data: T["data"]) => void
  ): void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    listeners.get(event)!.add(callback)
  }

  function off<T extends Evt>(
    event: T["name"],
    callback: (ctx: AppContext, data?: T["data"]) => void
  ): void {
    listeners.get(event)?.delete(callback)
  }

  const globalContext: KiruGlobalContext = {
    get apps() {
      return Array.from(contexts)
    },
    emit,
    on,
    off,
  }

  // Initialize event listeners
  on("mount", (ctx, requestUpdate) => {
    contexts.add(ctx)
    if (requestUpdate && typeof requestUpdate === "function") {
      contextToSchedulerInterface.set(ctx, { requestUpdate })
    }
  })
  on("unmount", (ctx) => {
    contexts.delete(ctx)
    contextToSchedulerInterface.delete(ctx)
  })

  if (__DEV__) {
    globalContext.HMRContext = createHMRContext()
    globalContext.profilingContext = createProfilingContext()
    globalContext.fileRouterInstance = fileRouterInstance
    globalContext.getSchedulerInterface = (app) => {
      return contextToSchedulerInterface.get(app) ?? null
    }
  }

  return globalContext
}
