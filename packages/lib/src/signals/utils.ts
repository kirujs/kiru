import { call } from "../utils/index.js"
import { isSignal, type Signal } from "./base.js"
import { effectQueue } from "./globals.js"
import { tracking } from "./tracking.js"

/** Plain value, or the inner type when `T` is (or includes) a `Signal`. */

export function unwrap<T>(value: T | Signal<T>, reactive = false): T {
  if (!isSignal(value)) return value as T
  return reactive ? value() : value.peek()
}

export function tick() {
  effectQueue.forEach(call)
  effectQueue.clear()
}

export function untrack<T>(fn: () => T) {
  tracking.enabled = false
  const result = fn()
  tracking.enabled = true
  return result
}
