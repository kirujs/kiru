import { call } from "../utils/index.js"
import { Signal } from "./base.js"
import { effectQueue } from "./globals.js"

export function unwrap<T>(value: T | Signal<T>, reactive = false): T {
  if (!Signal.isSignal(value)) return value
  return reactive ? value.value : value.peek()
}

export const tick = () => {
  effectQueue.forEach(call)
  effectQueue.clear()
}
