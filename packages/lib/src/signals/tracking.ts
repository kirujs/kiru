import { node } from "../globals.js"
import { sideEffectsEnabled } from "../utils/index.js"
import { effectQueue } from "./globals.js"
import { tick } from "./utils.js"
import type { Signal } from "./base.js"
import type { SignalValues } from "./types.js"

export type TrackingStackObservations = Map<string, Signal<unknown>>
export const tracking = {
  enabled: true,
  stack: new Array<TrackingStackObservations>(),
  current: function (): TrackingStackObservations | undefined {
    return this.stack[this.stack.length - 1]
  },
}

type TrackedExecutionContext<T, Deps extends readonly Signal<unknown>[]> = {
  id: string
  subs: Map<string, Function>
  fn: (...values: SignalValues<Deps>) => T
  deps?: Deps
  onDepChanged: () => void
}

/**
 * Executes an effect function with dependency tracking enabled, and manages
 * the effect's subscriptions.
 * @param ctx - The execution context
 * @returns The result of the effect function
 */
export function executeWithTracking<T, Deps extends readonly Signal<unknown>[]>(
  ctx: TrackedExecutionContext<T, Deps>
): T {
  const { id, subs, fn, deps = [], onDepChanged } = ctx
  let observations: Map<string, Signal<unknown>> | undefined

  effectQueue.delete(id)
  const isServer = !!node.current && !sideEffectsEnabled()

  if (!isServer) {
    observations = new Map<string, Signal<unknown>>()
    tracking.stack.push(observations)
  }

  const result = fn(...(deps.map((s) => s.value) as SignalValues<Deps>))

  if (!isServer) {
    for (const [id, unsub] of subs) {
      if (observations!.has(id)) continue
      unsub()
      subs.delete(id)
    }

    const effect = () => {
      if (!effectQueue.size) {
        queueMicrotask(tick)
      }
      effectQueue.set(id, onDepChanged)
    }

    for (const [id, sig] of observations!) {
      if (subs.has(id)) continue
      const unsub = sig.subscribe(effect)
      subs.set(id, unsub)
    }
    tracking.stack.pop()
  }

  return result
}
