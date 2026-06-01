import { __DEV__ } from "../env.js"
import { KiruError } from "../error.js"
import { effectQueue } from "../signals/globals.js"
import { executeWithTracking } from "../signals/tracking.js"
import { call, generateRandomID, latest, sideEffectsEnabled } from "../utils/index.js"
import {
  getCurrentOwner,
  registerOwnerCleanup,
  runWithOwner,
} from "./owner.js"
import type { Owner } from "./types.js"
import type { DomComponentInstance } from "./instance.js"
import {
  getCurrentDomInstance,
  registerPropBoundEffect,
  runWithDomInstance,
  runWithPropPathTracking,
} from "./instance.js"

type DomEffectCallbackReturn = (() => void) | void

class DomEffect {
  readonly id: string
  protected callback: () => DomEffectCallbackReturn
  protected unsubs: Map<string, Function>
  protected cleanup: (() => void) | null
  protected unregisterPropBound: (() => void) | null = null
  protected patchOwner: Owner | null = null
  protected domInstance: DomComponentInstance<Record<string, unknown>> | null =
    null
  protected isRunning = false

  constructor(callback: () => DomEffectCallbackReturn) {
    this.id = generateRandomID()
    this.callback = callback
    this.unsubs = new Map()
    this.cleanup = null

    const o = getCurrentOwner()
    if (__DEV__ && !o) {
      throw new KiruError({
        message: "[kiru/dom]: domEffect must be created inside an owner scope",
      })
    }
    this.patchOwner = o
    if (o && sideEffectsEnabled()) {
      registerOwnerCleanup(o, this.id, this.stop.bind(this))
    }
    this.start()
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    DomEffect.run(this)
  }

  stop(): void {
    effectQueue.delete(this.id)
    this.unsubs.forEach(call)
    this.unsubs.clear()
    this.unregisterPropBound?.()
    this.unregisterPropBound = null
    this.cleanup?.()
    this.cleanup = null
    this.isRunning = false
  }

  private static run(domEffect: DomEffect): void {
    const effect = latest(domEffect)
    const { id, callback: getter, unsubs } = effect

    effect.unregisterPropBound?.()
    effect.unregisterPropBound = null

    effect.cleanup =
      executeWithTracking({
        id,
        subs: unsubs,
        fn: () => {
          try {
            effect.domInstance = getCurrentDomInstance()
          } catch {
            // keep prior instance for reruns (e.g. signal-only deps)
          }
          const { value, paths } = runWithPropPathTracking(getter)
          if (paths.size > 0) {
            try {
              const inst = getCurrentDomInstance()
              effect.domInstance = inst
              effect.unregisterPropBound = registerPropBoundEffect(
                inst,
                paths,
                () => {
                  effect.cleanup?.()
                  DomEffect.rerun(effect, inst)
                }
              )
            } catch {
              // domEffect outside component instance (e.g. mount root)
            }
          }
          return value
        },
        onDepChanged: () => {
          effect.cleanup?.()
          DomEffect.rerun(effect, effect.domInstance)
        },
      }) ?? null
  }

  private static rerun(
    effect: DomEffect,
    inst: DomComponentInstance<Record<string, unknown>> | null
  ): void {
    const patchOwner = effect.patchOwner
    const run = () => {
      if (inst) {
        runWithDomInstance(inst, () => DomEffect.run(effect))
      } else {
        DomEffect.run(effect)
      }
    }
    if (patchOwner) {
      runWithOwner(patchOwner, run)
    } else {
      run()
    }
  }
}

export function domEffect(callback: () => DomEffectCallbackReturn): DomEffect {
  return new DomEffect(callback)
}
