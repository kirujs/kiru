import { call } from "../utils/index.js"
import { Signal } from "./base.js"
import { effectQueue } from "./globals.js"
import { tracking } from "./tracking.js"

export function unwrap<T>(value: T | Signal<T>, reactive = false): T {
  if (!Signal.isSignal(value)) return value
  return reactive ? value.value : value.peek()
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
