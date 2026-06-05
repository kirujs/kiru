import type { RemoteQuery, RemoteQueryInstance } from "./query.js"
import {
  queryHandleForWireEntry,
  refreshQueryForWireEntry,
} from "./query.js"
import { getActiveRequestedEntries } from "./requestedScope.js"

export type RequestedQueryRefreshable =
  | RemoteQueryInstance<unknown, unknown>
  | (RemoteQuery<void, unknown> & { refresh(): Promise<unknown> })

export type RequestedQueryEntry = {
  input: unknown
  query: RequestedQueryRefreshable
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
        const query = queryHandleForWireEntry(
          queryFn,
          entry.input
        ) as RequestedQueryRefreshable
        yield {
          input: entry.input,
          query,
          refresh(): Promise<unknown> {
            return query.refresh()
          },
        }
      }
    },
  }
}
