import { Signal } from "../signals/base.js"
import { call, latest, noop, sideEffectsEnabled } from "./shared-runtime.js"

export { call, noop, latest, composeRefs, setRef, sideEffectsEnabled }

/**
 * Composes multiple refs into a single ref callback.
 */

function composeRefs<T>(...refs: Array<Kiru.Ref<T>>): Kiru.RefCallback<T> {
  return (value: T) => {
    refs.forEach((ref) => setRef(ref, value))
  }
}

/**
 * Sets the value of a ref.
 */
function setRef<T>(ref: Kiru.Ref<T>, value: T): void {
  if (typeof ref === "function") {
    ref(value)
    return
  }
  if (Signal.isSignal(ref)) {
    ref.value = value
    return
  }
  ref.current = value
}
