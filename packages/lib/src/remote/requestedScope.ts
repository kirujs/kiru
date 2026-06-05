import type { RequestedQueryWireEntry } from "./mutationWire.js"

let activeRequested: RequestedQueryWireEntry[] = []

export function beginRequestedScope(
  requested: RequestedQueryWireEntry[]
): void {
  activeRequested = requested
}

export function endRequestedScope(): void {
  activeRequested = []
}

export function getActiveRequestedEntries(): RequestedQueryWireEntry[] {
  return activeRequested
}
