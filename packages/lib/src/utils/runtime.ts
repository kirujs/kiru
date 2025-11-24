import { Signal } from "../signals/base.js"
import { __DEV__ } from "../env.js"
import { renderMode } from "../globals.js"

export { noop, latest, composeRefs, setRef, sideEffectsEnabled }

const noop = Object.freeze(() => {})

/**
 * This is a no-op in production. It is used to get the latest
 * iteration of a component or signal after HMR has happened.
 */
function latest<T extends Exclude<object, null>>(thing: T): T {
  let tgt: any = thing
  if (__DEV__) {
    while ("__next" in tgt) {
      tgt = tgt.__next as typeof tgt
    }
  }
  return tgt
}

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

/**
 * Returns true if called during 'dom' or 'hydrate' mode.
 */
function sideEffectsEnabled(): boolean {
  return renderMode.current === "dom" || renderMode.current === "hydrate"
}
