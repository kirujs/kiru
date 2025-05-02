import type { AppContext } from "./appContext"
import { __DEV__ } from "./env.js"
import { createHMRContext } from "./hmr.js"
import { Store } from "./store"

export { KaiokenGlobalContext, type GlobalKaiokenEvent }

class ReactiveMap<V> {
  #map = new Map<string, V>()
  #listeners = new Set<(value: Record<string, V>) => void>()
  add(key: string, value: V) {
    if (this.#map.has(key)) return
    this.#map.set(key, value)
    this.notify()
  }
  delete(key: string) {
    if (!this.#map.has(key)) return
    this.#map.delete(key)
    this.notify()
  }

  private notify() {
    const val = Object.fromEntries(this.#map)
    this.#listeners.forEach((cb) => cb(val))
  }
  subscribe(cb: (value: Record<string, V>) => void) {
    this.#listeners.add(cb)
    cb(Object.fromEntries(this.#map))
    return () => this.#listeners.delete(cb)
  }
  get size() {
    return this.#map.size
  }
}

type Evt =
  | {
      name: "mount"
      data?: undefined
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

type GlobalKaiokenEvent = Evt["name"]

class KaiokenGlobalContext {
  #contexts: Set<AppContext> = new Set()
  private listeners: Map<
    GlobalKaiokenEvent,
    Set<(ctx: AppContext, data?: Evt["data"]) => void>
  > = new Map()
  stores: ReactiveMap<Store<any, any>> = new ReactiveMap()
  HMRContext?: ReturnType<typeof createHMRContext>
  globalState: Record<symbol, any> = {}

  constructor() {
    this.on("mount", (ctx) => this.#contexts.add(ctx))
    this.on("unmount", (ctx) => this.#contexts.delete(ctx))
    if (__DEV__) {
      this.HMRContext = createHMRContext()
    }
  }

  get apps() {
    return Array.from(this.#contexts)
  }

  emit<T extends Evt>(event: T["name"], ctx: AppContext, data?: T["data"]) {
    this.listeners.get(event)?.forEach((cb) => cb(ctx, data))
  }
  on<T extends Evt>(
    event: T["name"],
    callback: (ctx: AppContext, data: T["data"]) => void
  ) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }
  off<T extends Evt>(
    event: T["name"],
    callback: (ctx: AppContext, data?: T["data"]) => void
  ) {
    if (!this.listeners.has(event)) {
      return
    }
    this.listeners.get(event)!.delete(callback)
  }
}
