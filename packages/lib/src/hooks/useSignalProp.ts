import { unwrap } from "../signals"
import { Signal, useSignal } from "../signals/base.js"
import { useEffect } from "./useEffect"

/**
 * Returns a signal mirroring the given value or signal, syncing updates both ways.
 *
 * @see https://kirujs.dev/docs/hooks/useSignalProp
 */
export function useSignalProp<T>(prop: T | Signal<T>): Signal<T> {
  const raw = unwrap(prop)
  const sig = useSignal(raw)

  useEffect(() => {
    if (!Signal.isSignal(prop)) return

    // Prop changed → update local signal
    const onPropChange = (value: T) => {
      if (sig.peek() === value) return
      sig.sneak(value)
      sig.notify((sub) => sub !== onLocalChange)
    }

    // Local signal changed → update prop
    const onLocalChange = (value: T) => {
      if (prop.peek() === value) return
      prop.sneak(value)
      prop.notify((sub) => sub !== onPropChange)
    }

    const stopLocal = sig.subscribe(onLocalChange)
    const stopProp = prop.subscribe(onPropChange)

    return () => {
      stopLocal()
      stopProp()
    }
  }, [prop])

  return sig
}
