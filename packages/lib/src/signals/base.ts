import {
  latest,
  safeStringify,
  sideEffectsEnabled,
  generateRandomID,
  registerVNodeCleanup,
} from "../utils/index.js"
import { $HMR_ACCEPT, $SIGNAL } from "../constants.js"
import { __DEV__ } from "../env.js"
import { node } from "../globals.js"
import { requestUpdate } from "../scheduler.js"
import { signalSubsMap } from "./globals.js"
import { tracking } from "./tracking.js"
import type { SignalSubscriber, ReadonlySignal } from "./types.js"
import type { HMRAccept } from "../hmr.js"

export class Signal<T> {
  [$SIGNAL] = true;
  [$HMR_ACCEPT]?: HMRAccept<Signal<any>>
  displayName?: string
  protected $subs?: Set<SignalSubscriber<any>>
  protected $id: string
  protected $value: T
  protected $prevValue?: T
  protected $initialValue?: string
  protected __next?: Signal<T>
  protected $isDisposed?: boolean

  constructor(initial: T, displayName?: string) {
    this.$id = generateRandomID()
    this.$value = initial
    if (displayName) this.displayName = displayName

    if (__DEV__) {
      signalSubsMap.set(this.$id, new Set())
      this.$initialValue = safeStringify(initial)
      this[$HMR_ACCEPT] = {
        provide: () => {
          return this as Signal<any>
        },
        inject: (prev) => {
          window.__kiru.devtools?.untrack(prev)
          signalSubsMap.get(this.$id)?.clear?.()
          signalSubsMap.delete(this.$id)
          this.$id = prev.$id
          // @ts-ignore - this handles scenarios where a reference to the prev has been encapsulated
          // and we need to be able to refer to the latest version of the signal.
          prev.__next = this

          if (this.$initialValue === prev.$initialValue) {
            this.$value = prev.$value
          } else {
            this.notify()
          }
        },
        destroy: () => {},
      } satisfies HMRAccept<Signal<any>>
    } else {
      this.$subs = new Set()
    }

    const n = node.current
    if (n) {
      registerVNodeCleanup(n, this.$id, Signal.dispose.bind(null, this))
    }
  }

  get value() {
    if (__DEV__) {
      const tgt = latest(this)
      Signal.entangle(tgt)
      return tgt.$value
    }
    Signal.entangle(this)
    return this.$value
  }

  set value(next: T) {
    if (__DEV__) {
      const tgt = latest(this)
      if (Object.is(tgt.$value, next)) return
      tgt.$prevValue = tgt.$value
      tgt.$value = next
      tgt.notify()
      return
    }
    if (Object.is(this.$value, next)) return
    this.$prevValue = this.$value
    this.$value = next
    this.notify()
  }

  peek() {
    if (__DEV__) {
      return latest(this).$value
    }
    return this.$value
  }

  sneak(newValue: T) {
    if (__DEV__) {
      const tgt = latest(this)
      tgt.$prevValue = tgt.$value
      tgt.$value = newValue
      return
    }
    this.$prevValue = this.$value
    this.$value = newValue
  }

  toString() {
    if (__DEV__) {
      const tgt = latest(this)
      Signal.entangle(tgt)
      return `${tgt.$value}`
    }
    Signal.entangle(this)
    return `${this.$value}`
  }

  subscribe(cb: (state: T, prevState?: T) => void): () => void {
    if (__DEV__) {
      const subs = signalSubsMap.get(this.$id)!
      subs!.add(cb)
      return () => signalSubsMap.get(this.$id)?.delete(cb)
    }
    this.$subs!.add(cb)
    return () => this.$subs!.delete(cb)
  }

  notify(filter?: (sub: SignalSubscriber) => boolean) {
    if (__DEV__) {
      return signalSubsMap.get(this.$id)?.forEach((sub) => {
        if (filter && !filter(sub)) return
        const { $value, $prevValue } = latest(this)
        return sub($value, $prevValue)
      })
    }
    this.$subs!.forEach((sub) => {
      if (filter && !filter(sub)) return
      return sub(this.$value, this.$prevValue)
    })
  }

  static isSignal(x: any): x is Signal<any> {
    return typeof x === "object" && !!x && $SIGNAL in x
  }

  static subscribers(signal: Signal<any>) {
    if (__DEV__) {
      return signalSubsMap.get(signal.$id)!
    }
    return signal.$subs
  }

  static makeReadonly<T>(signal: Signal<T>): ReadonlySignal<T> {
    const desc = Object.getOwnPropertyDescriptor(signal, "value")
    if (desc && !desc.writable) return signal
    return Object.defineProperty(signal, "value", {
      get: function (this: Signal<T>) {
        Signal.entangle(this)
        return this.$value
      },
      configurable: true,
    })
  }

  static makeWritable<T>(signal: Signal<T>): Signal<T> {
    const desc = Object.getOwnPropertyDescriptor(signal, "value")
    if (desc && desc.writable) return signal
    return Object.defineProperty(signal, "value", {
      get: function (this: Signal<T>) {
        Signal.entangle(this)
        return this.$value
      },
      set: function (this: Signal<T>, value) {
        this.$value = value
        this.notify()
      },
      configurable: true,
    })
  }

  static entangle<T>(signal: Signal<T>) {
    if (tracking.enabled === false) return

    const vNode = node.current
    const trackedSignalObservations = tracking.current()
    if (trackedSignalObservations) {
      if (!vNode || (vNode && sideEffectsEnabled())) {
        trackedSignalObservations.set(signal.$id, signal)
      }
      return
    }
    if (!vNode || !sideEffectsEnabled()) return
    const unsub = signal.subscribe(() => requestUpdate(vNode))
    ;(vNode.subs ??= new Set()).add(unsub)
  }

  static dispose(signal: Signal<any>) {
    signal.$isDisposed = true
    if (__DEV__) {
      signalSubsMap.delete(signal.$id)
      window.__kiru.devtools?.untrack(signal)
      return
    }
    signal.$subs!.clear()
  }
}

export const signal = <T>(initial: T, displayName?: string) => {
  return new Signal(initial, displayName)
}
