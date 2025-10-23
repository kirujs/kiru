import { __DEV__ } from "../env.js"
import { renderMode } from "../globals.js"

export { latest, sideEffectsEnabled }

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
 * Returns false if called during "stream" or "string" render modes.
 */
function sideEffectsEnabled(): boolean {
  return renderMode.current === "dom" || renderMode.current === "hydrate"
}
