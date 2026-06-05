import { buildQueryCacheKey } from "./queryCache.js"
import type { RemoteCallOptions } from "./remoteCallOptions.js"
import { captureSyncQueryObservations } from "./queryCacheTrack.js"
import type { RemoteQuery } from "./query.js"

/** Start a query load; cache keys are recorded only during this synchronous call. */
export function kickQueryLoad<Input, Output>(
  queryFn: RemoteQuery<Input, Output>,
  input: Input | undefined,
  options?: RemoteCallOptions
): Promise<Output> {
  if (queryFn.__kiruQueryVoid) {
    return (
      queryFn as unknown as (
        options?: RemoteCallOptions
      ) => Promise<Output>
    )(options)
  }
  return (
    queryFn as unknown as (
      input: Input,
      options?: RemoteCallOptions
    ) => Promise<Output>
  )(input as Input, options)
}

export function invokeQueryLoad<Input, Output>(
  queryFn: RemoteQuery<Input, Output>,
  input: Input | undefined,
  signal: AbortSignal
): Promise<Output> {
  return kickQueryLoad(queryFn, input, { signal })
}

export function invokeQueryLoadWithObservation<Input, Output>(
  queryFn: RemoteQuery<Input, Output>,
  input: Input | undefined,
  signal: AbortSignal
): { observed: Set<string>; promise: Promise<Output> } {
  const { observed, value: promise } = captureSyncQueryObservations(() =>
    kickQueryLoad(queryFn, input, { signal })
  )
  return { observed, promise }
}

export function buildQueryCacheKeyForQuery(
  queryFn: RemoteQuery<unknown, unknown>,
  input: unknown
): string {
  return buildQueryCacheKey(
    queryFn.__kiruQueryId ?? "",
    input === undefined ? null : input
  )
}
