import { __DEV__ } from "../env.js"
import { getSsrRemoteScopeEntry } from "./ssrRemoteScope.js"

export type QueryTracePath =
  | "cache-data"
  | "cache-pending"
  | "in-process"
  | "rpc"

export function isQueryTraceEnabled(): boolean {
  return (
    __DEV__ &&
    (process.env.KIRU_QUERY_TRACE === "1" ||
      process.env.KIRU_QUERY_TRACE === "true")
  )
}

export function traceQueryDispatch(
  event: string,
  detail: Record<string, unknown>
): void {
  if (!isQueryTraceEnabled()) return
  // eslint-disable-next-line no-console
  console.info(`[kiru:query] ${event}`, {
    ssrScope: getSsrRemoteScopeEntry() != null,
    ...detail,
  })
}
