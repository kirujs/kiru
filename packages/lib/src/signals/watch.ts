import { __DEV__ } from "../env.js"
import type { HMRAccept } from "../hmr.js"
import { $HMR_ACCEPT } from "../constants.js"
import { useHook } from "../hooks/utils.js"
import { effectQueue } from "./globals.js"
import { executeWithTracking } from "./effect.js"
import { latest, sideEffectsEnabled, generateRandomID } from "../utils/index.js"
import type { Signal } from "./base.js"
import type { SignalValues } from "./types.js"

type WatchCallbackReturn = (() => void) | void

export class WatchEffect<const Deps extends readonly Signal<unknown>[] = []> {
  protected id: string
  protected getter: (...values: SignalValues<Deps>) => WatchCallbackReturn
  protected deps?: Deps
  protected unsubs: Map<string, Function>
  protected cleanup: (() => void) | null
  protected isRunning?: boolean
  protected [$HMR_ACCEPT]?: HMRAccept<WatchEffect<Deps>>

  constructor(
    getter: (...values: SignalValues<Deps>) => WatchCallbackReturn,
    deps?: Deps
  ) {
    this.id = generateRandomID()
    this.getter = getter
    this.deps = deps
    this.unsubs = new Map()
    this.isRunning = false
    this.cleanup = null
    if (__DEV__) {
      this[$HMR_ACCEPT] = {
        provide: () => this,
        inject: (prev) => {
          if (prev.isRunning) return
          this.stop()
        },
        destroy: () => {
          this.stop()
        },
      }
      if ("window" in globalThis) {
        const signals = window.__kiru!.HMRContext!.signals
        if (signals.isWaitingForNextWatchCall()) {
          signals.pushWatch(this as WatchEffect)
        }
      }
    }
    this.start()
  }

  start() {
    if (this.isRunning) {
      return
    }

    this.isRunning = true

    if (__DEV__) {
      // postpone execution during HMR
      if (
        "window" in globalThis &&
        window.__kiru?.HMRContext?.isReplacement()
      ) {
        return queueMicrotask(() => {
          if (this.isRunning) {
            WatchEffect.run(this as WatchEffect)
          }
        })
      }
    }
    WatchEffect.run(this as WatchEffect)
  }

  stop() {
    effectQueue.delete(this.id)
    this.unsubs.forEach((fn) => fn())
    this.unsubs.clear()
    this.cleanup?.()
    this.cleanup = null
    this.isRunning = false
  }

  private static run(watchEffect: WatchEffect) {
    const effect = latest(watchEffect)
    const { id, getter, unsubs: subs, deps } = effect

    effect.cleanup =
      executeWithTracking({
        id,
        subs,
        fn: getter,
        deps,
        onDepChanged: () => {
          effect.cleanup?.()
          WatchEffect.run(effect)
        },
      }) ?? null
  }
}

export function watch(getter: () => WatchCallbackReturn): WatchEffect
export function watch<const Deps extends readonly Signal<unknown>[]>(
  dependencies: Deps,
  getter: (...values: SignalValues<Deps>) => WatchCallbackReturn
): WatchEffect<Deps>
export function watch<const Deps extends readonly Signal<unknown>[]>(
  depsOrGetter: Deps | (() => WatchCallbackReturn),
  getter?: (...values: SignalValues<Deps>) => WatchCallbackReturn
): WatchEffect<Deps> | WatchEffect {
  if (typeof depsOrGetter === "function") {
    return new WatchEffect<[]>(depsOrGetter)
  }
  const dependencies = depsOrGetter
  const effectGetter = getter!
  return new WatchEffect(effectGetter, dependencies)
}

export function useWatch(getter: () => WatchCallbackReturn): WatchEffect
export function useWatch<const Deps extends readonly Signal<unknown>[]>(
  dependencies: Deps,
  getter: (...values: SignalValues<Deps>) => WatchCallbackReturn
): WatchEffect<Deps> | undefined

export function useWatch<const Deps extends readonly Signal<unknown>[]>(
  depsOrGetter: Deps | (() => WatchCallbackReturn),
  getter?: (...values: SignalValues<Deps>) => WatchCallbackReturn
): WatchEffect<Deps> | WatchEffect | undefined {
  if (!sideEffectsEnabled()) return

  return useHook(
    "useWatch",
    { watcher: null as any as WatchEffect<Deps> },
    ({ hook, isInit, isHMR }) => {
      if (__DEV__) {
        if (isHMR) {
          hook.cleanup?.()
          isInit = true
        }
      }
      if (isInit) {
        const watcher = (hook.watcher = watch(depsOrGetter as Deps, getter!))
        hook.cleanup = () => watcher.stop()
      }

      return hook.watcher
    }
  )
}
