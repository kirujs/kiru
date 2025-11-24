import { $STREAM_DATA } from "../constants.js"

export interface StreamDataThrowValue {
  [$STREAM_DATA]: {
    fallback?: JSX.Element
    data: Kiru.StatefulPromise<unknown>[]
  }
}

/**
 * Returns true if the value is a {@link StreamDataThrowValue}
 */
export function isStreamDataThrowValue(
  value: unknown
): value is StreamDataThrowValue {
  return typeof value === "object" && !!value && $STREAM_DATA in value
}

/**
 * Returns true if the value is a {@link Kiru.StatefulPromise}
 */
export function isStatefulPromise(
  thing: unknown
): thing is Kiru.StatefulPromise<unknown> {
  return thing instanceof Promise && "id" in thing && "state" in thing
}
