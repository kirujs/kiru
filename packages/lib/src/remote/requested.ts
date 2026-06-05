import type { RemoteQuery } from "./query.js"
import { refreshQueryForWireEntry } from "./query.js"
import { getActiveRequestedEntries } from "./requestedScope.js"

export type RequestedQueryEntry = {
  input: unknown
  query: RemoteQuery<unknown, unknown>
  refresh(): Promise<unknown>
}

export function requested<Input, Output>(
  queryFn: RemoteQuery<Input, Output>,
  limit: number
): {
  refreshAll(): Promise<void>
  [Symbol.iterator](): Iterator<RequestedQueryEntry>
} {
  const queryId = queryFn.__kiruQueryId ?? ""
  const entries = getActiveRequestedEntries()
    .filter((e) => e.queryId === queryId)
    .slice(0, limit)

  return {
    async refreshAll() {
      for (const entry of entries) {
        await refreshQueryForWireEntry(queryFn, entry.input)
      }
    },
    *[Symbol.iterator]() {
      for (const entry of entries) {
        yield {
          input: entry.input,
          query: queryFn as RemoteQuery<unknown, unknown>,
          refresh(): Promise<unknown> {
            return refreshQueryForWireEntry(queryFn, entry.input)
          },
        }
      }
    },
  }
}
