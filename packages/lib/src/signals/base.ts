import { $HMR_ACCEPT, $SIGNAL } from "../constants.js"
import { __DEV__ } from "../env.js"
import type { HMRAccept } from "../hmr.js"
import {
  getVNodeAppContext,
  latest,
  safeStringify,
  sideEffectsEnabled,
} from "../utils.js"
import { tracking, signalSubsMap } from "./globals.js"
import { type SignalSubscriber, ReadonlySignal } from "./types.js"
import { node } from "../globals.js"
import { useHook } from "../hooks/utils.js"
import { generateRandomID } from "../generateId.js"

export class Signal<T> {
  [$SIGNAL] = true;
  [$HMR_ACCEPT]?: HMRAccept<Signal<any>>
  displayName?: string
  protected $id: string
  protected $value: T
  protected $initialValue?: string
  protected __next?: Signal<T>
  constructor(initial: T, displayName?: string) {
    this.$id = generateRandomID()
    signalSubsMap.set(this.$id, new Set())

    this.$value = initial
    if (displayName) this.displayName = displayName
    if (__DEV__) {
      this.$initialValue = safeStringify(initial)
      this[$HMR_ACCEPT] = {
        provide: () => {
          return this as Signal<any>
        },
        inject: (prev) => {
          if (this.$initialValue === prev.$initialValue) {
            this.$value = prev.$value
          }

          signalSubsMap.get(this.$id)?.clear?.()
          signalSubsMap.delete(this.$id)
          this.$id = prev.$id
          // @ts-ignore - this handles scenarios where a reference to the prev has been encapsulated
          // and we need to be able to refer to the latest version of the signal.
          prev.__next = this
        },
        destroy: () => {},
      } satisfies HMRAccept<Signal<any>>
    }
  }

  get value() {
    const tgt = latest(this)
    Signal.entangle(tgt)
    return tgt.$value
  }

  set value(next: T) {
    const tgt = latest(this)
    if (Object.is(tgt.$value, next)) return
    tgt.$value = next
    tgt.notify()
  }

  peek() {
    const tgt = latest(this)
    return tgt.$value
  }

  sneak(newValue: T) {
    const tgt = latest(this)
    tgt.$value = newValue
  }

  toString() {
    const tgt = latest(this)
    Signal.entangle(tgt)
    return `${tgt.$value}`
  }

  subscribe(cb: (state: T) => void): () => void {
    const subs = signalSubsMap.get(this.$id)!
    subs!.add(cb)
    return () => signalSubsMap.get(this.$id)?.delete(cb)
  }

  notify(options?: { filter?: (sub: Function | Kaioken.VNode) => boolean }) {
    const tgt = latest(this)
    signalSubsMap.get(this.$id)?.forEach((sub) => {
      if (options?.filter && !options.filter(sub)) return
      if (typeof sub === "function") {
        return sub(tgt.$value)
      }
      getVNodeAppContext(sub).requestUpdate(sub)
    })
  }

  static isSignal(x: any): x is Signal<any> {
    return typeof x === "object" && !!x && $SIGNAL in x
  }

  static unsubscribe(sub: SignalSubscriber, id: string) {
    signalSubsMap.get(id)?.delete(sub)
  }

  static subscribers(signal: Signal<any>) {
    return signalSubsMap.get(signal.$id)!
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

  static getId<T>(signal: Signal<T>) {
    return signal.$id
  }

  static entangle<T>(signal: Signal<T>) {
    if (tracking.enabled) {
      if (!node.current || (node.current && sideEffectsEnabled())) {
        tracking.signals.push(signal)
      }
      return
    }
    if (node.current) {
      if (!sideEffectsEnabled()) return
      if (!node.current.subs) node.current.subs = [signal.$id]
      else if (node.current.subs.indexOf(signal.$id) === -1)
        node.current.subs.push(signal.$id)
      Signal.subscribers(signal).add(node.current)
    }
  }

  static dispose(signal: Signal<any>) {
    signalSubsMap.delete(signal.$id)
  }
}

export const signal = <T>(initial: T, displayName?: string) => {
  return new Signal(initial, displayName)
}

export const useSignal = <T>(initial: T, displayName?: string) => {
  return useHook(
    "useSignal",
    { signal: undefined as any as Signal<T> },
    ({ hook, isInit }) => {
      if (__DEV__) {
        hook.dev = {
          reinitUponRawArgsChanged: true,
          devtools: {
            get: () => ({
              displayName: hook.signal.displayName,
              value: hook.signal.peek(),
            }),
            set: ({ value }) => {
              hook.signal.value = value
            },
          },
        }
        if (isInit && hook.dev.rawArgsChanged) {
          hook.signal.value = initial
          return hook.signal
        }
      }
      if (isInit) {
        hook.cleanup = () => Signal.dispose(hook.signal)
        hook.signal = new Signal(initial, displayName)
      }
      return hook.signal
    }
  )
}
