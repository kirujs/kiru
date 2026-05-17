import { $STREAM_DATA } from "../constants.js"

export interface StreamDataThrowValue {
  [$STREAM_DATA]: {
    fallback?: JSX.Element
    data: Kiru.StatefulPromise<unknown>[]
    continue: () => JSX.Children
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
