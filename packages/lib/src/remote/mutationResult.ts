import {
  buildQueryCacheKey,
  getQueryCacheEntry,
  setQueryCacheEntry,
} from "./queryCache.js"
import type { RemoteQuery, RemoteQueryBrand, RemoteQueryInstance } from "./query.js"
import {
  buildMutationWireBody,
  type RequestedQueryWireEntry,
} from "./mutationWire.js"
import { dispatchMutationRpc } from "./remoteClientDispatch.js"
import type { RemoteCallOptions } from "./remoteCallOptions.js"

/** Factory or keyed instance passed to `mutationResult.updates()`. */
export type QueryUpdateTarget =
  | RemoteQueryBrand
  | RemoteQueryInstance<unknown, unknown>

export type MutationResult<T> = Promise<T> & {
  updates(...targets: QueryUpdateTarget[]): Promise<T>
}

function wireEntryFromTarget(target: QueryUpdateTarget): RequestedQueryWireEntry {
  if (typeof target === "function" && "__kiruRemoteQuery" in target) {
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

export function wrapMutationResult<T>(
  promise: Promise<T>,
  mutationId: string,
  input: unknown,
  options?: RemoteCallOptions
): MutationResult<T> {
  const result = promise as MutationResult<T>

  result.updates = async (...targets: QueryUpdateTarget[]) => {
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
      return (await dispatchMutationRpc(
        mutationId,
        buildMutationWireBody(input, requested),
        options
      )) as T
    } catch (e) {
      for (const { key, prev } of snapshots) {
        if (prev !== undefined) setQueryCacheEntry(key, prev)
      }
      throw e
    }
  }

  return result
}

export function wrapFormSubmitResult<T>(
  run: (targets?: QueryUpdateTarget[]) => Promise<T>
): MutationResult<T> {
  const result = run() as MutationResult<T>
  result.updates = (...targets: QueryUpdateTarget[]) => run(targets)
  return result
}
