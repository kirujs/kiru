import {
  buildQueryCacheKey,
  getQueryCacheEntry,
  setQueryCacheEntry,
} from "./queryCache.js"
import type {
  RemoteQuery,
  RemoteQueryBrand,
  RemoteQueryInstance,
  RemoteQueryOverride,
} from "./query.js"
import {
  buildMutationWireBody,
  type RequestedQueryWireEntry,
} from "./mutationWire.js"
import { dispatchMutationRpc } from "./remoteClientDispatch.js"
import type { RemoteCallOptions } from "./remoteCallOptions.js"

/** Factory or cache-bound instance passed to `mutationResult.updates()`. */
export type QueryUpdateTarget =
  | RemoteQueryBrand
  | RemoteQueryInstance<unknown, unknown>
  | RemoteQueryOverride<unknown, unknown>

export type MutationResult<T> = Promise<T> & {
  updates(...targets: QueryUpdateTarget[]): Promise<T>
}

function wireEntryFromTarget(target: QueryUpdateTarget): RequestedQueryWireEntry {
  if (
    typeof target === "function" &&
    "__kiruRemoteQuery" in target &&
    !("__kiruOptimisticOverride" in target)
  ) {
    const q = target as RemoteQuery<unknown, unknown>
    return { queryId: q.__kiruQueryId ?? "", input: null }
  }
  const inst = target as RemoteQueryInstance<unknown, unknown>
  const entry: RequestedQueryWireEntry = {
    queryId: inst.__kiruQueryId ?? "",
    input: inst.input === undefined ? null : inst.input,
  }
  if ("__kiruOptimisticOverride" in inst && inst.__kiruOptimisticOverride !== undefined) {
    entry.optimistic = inst.__kiruOptimisticOverride
  }
  return entry
}

export function buildRequestedFromTargets(
  targets: QueryUpdateTarget[]
): RequestedQueryWireEntry[] {
  return targets.map(wireEntryFromTarget)
}

type MutationDispatchFn<T> = (body: unknown) => Promise<T>

function createLazyMutationResult<T>(
  dispatch: MutationDispatchFn<T>,
  input: unknown
): MutationResult<T> {
  let settled = false
  let primaryPromise: Promise<T> | null = null

  const run = (requested?: RequestedQueryWireEntry[]): Promise<T> => {
    if (settled) {
      return dispatch(buildMutationWireBody(input, requested))
    }
    settled = true
    primaryPromise ??= dispatch(buildMutationWireBody(input, requested))
    return primaryPromise
  }

  const result = {
    updates: async (...targets: QueryUpdateTarget[]) => {
      const requested = buildRequestedFromTargets(targets)
      const snapshots: Array<{ key: string; prev: unknown }> = []
      for (const target of targets) {
        if (typeof target !== "object" || target == null) continue
        const inst = target as RemoteQueryInstance<unknown, unknown>
        if (inst.__kiruOptimisticOverride === undefined) continue
        const queryId = inst.__kiruQueryId
        if (!queryId) continue
        const key = buildQueryCacheKey(
          queryId,
          inst.input === undefined ? null : inst.input
        )
        snapshots.push({ key, prev: getQueryCacheEntry(key)?.data })
      }
      try {
        return await run(requested)
      } catch (e) {
        for (const { key, prev } of snapshots) {
          if (prev !== undefined) setQueryCacheEntry(key, prev)
        }
        throw e
      }
    },
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null
    ): Promise<TResult1 | TResult2> {
      return run().then(onfulfilled, onrejected)
    },
    catch<TResult = never>(
      onrejected?:
        | ((reason: unknown) => TResult | PromiseLike<TResult>)
        | null
    ): Promise<T | TResult> {
      return run().catch(onrejected)
    },
    finally(onfinally?: (() => void) | null): Promise<T> {
      return run().finally(onfinally)
    },
  } as MutationResult<T>

  return result
}

export function wrapMutationResult<T>(
  promise: Promise<T>,
  mutationId: string,
  input: unknown,
  options?: RemoteCallOptions
): MutationResult<T> {
  void promise
  return createLazyMutationResult(
    (body) => dispatchMutationRpc(mutationId, body, options) as Promise<T>,
    input
  )
}

export function wrapInProcessMutationResult<T>(
  dispatch: MutationDispatchFn<T>,
  input: unknown
): MutationResult<T> {
  return createLazyMutationResult(dispatch, input)
}

export function wrapFormSubmitResult<T>(
  run: (targets?: QueryUpdateTarget[]) => Promise<T>
): MutationResult<T> {
  let settled = false
  let primaryPromise: Promise<T> | null = null

  const dispatch = (targets?: QueryUpdateTarget[]) => {
    if (settled) return run(targets)
    settled = true
    primaryPromise ??= run(targets)
    return primaryPromise
  }

  const result = {
    updates: (...targets: QueryUpdateTarget[]) => dispatch(targets),
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null
    ): Promise<TResult1 | TResult2> {
      return dispatch().then(onfulfilled, onrejected)
    },
    catch<TResult = never>(
      onrejected?:
        | ((reason: unknown) => TResult | PromiseLike<TResult>)
        | null
    ): Promise<T | TResult> {
      return dispatch().catch(onrejected)
    },
    finally(onfinally?: (() => void) | null): Promise<T> {
      return dispatch().finally(onfinally)
    },
  } as MutationResult<T>

  return result
}
