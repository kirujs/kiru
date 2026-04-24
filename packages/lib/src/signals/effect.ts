import { __DEV__, isBrowser } from "../env.js"
import { effectQueue } from "./globals.js"
import { executeWithTracking } from "./tracking.js"
import { latest, call, sideEffectsEnabled } from "../utils/shared-runtime.js"
import { generateRandomID } from "../utils/generateId.js"
import { registerCleanup } from "../utils/node.js"
import type { Signal } from "./base.js"
import type { SignalValues } from "./types.js"
import { node } from "../globals.js"
import { $INLINE_FN } from "../constants.js"
import { KiruError } from "../error.js"

type EffectCallbackReturn = (() => void) | void

export class Effect<const Deps extends readonly Signal<unknown>[] = []> {
  protected id: string
  protected callback: (...values: SignalValues<Deps>) => EffectCallbackReturn
  protected deps?: Deps
  protected unsubs: Map<string, Function>
  protected cleanup: (() => void) | null
  protected isRunning?: boolean

  constructor(
    callback: (...values: SignalValues<Deps>) => EffectCallbackReturn,
    deps?: Deps
  ) {
    this.id = generateRandomID()
    this.callback = callback
    this.deps = deps
    this.unsubs = new Map()
    this.isRunning = false
    this.cleanup = null
    if (__DEV__ && isBrowser) {
      window.__kiru.HMRContext!.moduleEffects.push(this)
    }
    const n = node.current
    if (n) {
      if (__DEV__ && n.type === $INLINE_FN) {
        throw new KiruError({
          message: "Effects cannot be created inside inline functions",
          node: n,
        })
      }
      if (!sideEffectsEnabled()) return // prevent side effects in non-browser environments
      registerCleanup(n, this.id, this.stop.bind(this))
    }
    this.start()
  }

  start() {
    if (this.isRunning) {
      return
    }

    this.isRunning = true

    // postpone execution during HMR
    if (__DEV__ && isBrowser && window.__kiru.HMRContext?.isReplacement()) {
      return queueMicrotask(() => {
        if (this.isRunning) {
          Effect.run(this as Effect)
        }
      })
    }
    Effect.run(this as Effect)
  }

  stop() {
    effectQueue.delete(this.id)
    this.unsubs.forEach(call)
    this.unsubs.clear()
    this.cleanup?.()
    this.cleanup = null
    this.isRunning = false
  }

  private static run(watchEffect: Effect) {
    const effect = latest(watchEffect)
    const { id, callback: getter, unsubs: subs, deps } = effect

    effect.cleanup =
      executeWithTracking({
        id,
        subs,
        fn: getter,
        deps,
        onDepChanged: () => {
          effect.cleanup?.()
          Effect.run(effect)
        },
      }) ?? null
  }
}

export function effect(callback: () => EffectCallbackReturn): Effect
export function effect<const Deps extends readonly Signal<unknown>[]>(
  dependencies: Deps,
  callback: (...values: SignalValues<Deps>) => EffectCallbackReturn
): Effect<Deps>
export function effect<const Deps extends readonly Signal<unknown>[]>(
  depsOrGetter: Deps | (() => EffectCallbackReturn),
  callback?: (...values: SignalValues<Deps>) => EffectCallbackReturn
): Effect<Deps> | Effect {
  if (typeof depsOrGetter === "function") {
    return new Effect<[]>(depsOrGetter)
  }
  const dependencies = depsOrGetter
  const effectGetter = callback!
  return new Effect(effectGetter, dependencies)
}
