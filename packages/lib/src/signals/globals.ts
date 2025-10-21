import type { Signal } from "./base.js"
import type { SignalSubscriber } from "./types.js"

export const tracking = {
  stack: new Array<Map<string, Signal<unknown>>>(),
  current: function (): Map<string, Signal<unknown>> | undefined {
    return this.stack[this.stack.length - 1]
  },
}
export const effectQueue = new Map<string, Function>()
export const signalSubsMap: Map<string, Set<SignalSubscriber<any>>> = new Map()
