export const MAX_CLIENT_REQUESTED_QUERIES = 8

/** FormData field for client-requested query refreshes on form submit. */
export const KIRU_REQUESTED_QUERIES_FIELD = "__kiruRequestedQueries"

export type RequestedQueryWireEntry = {
  queryId: string
  input: unknown
  optimistic?: unknown
}

export type RemoteMutationWireBody<Input> =
  | Input
  | null
  | {
      input: Input | null
      requested?: RequestedQueryWireEntry[]
    }

export function parseMutationWireBody(raw: unknown): {
  input: unknown
  requested: RequestedQueryWireEntry[]
} {
  if (raw == null) return { input: null, requested: [] }
  if (Array.isArray(raw)) {
    return { input: raw, requested: [] }
  }
  if (typeof raw !== "object") {
    return { input: raw, requested: [] }
  }
  if ("input" in raw) {
    const envelope = raw as {
      input: unknown
      requested?: RequestedQueryWireEntry[]
    }
    const requested = Array.isArray(envelope.requested)
      ? envelope.requested.slice(0, MAX_CLIENT_REQUESTED_QUERIES)
      : []
    return { input: envelope.input ?? null, requested }
  }
  return { input: raw, requested: [] }
}

export function parseRequestedFromFormData(
  formData: FormData
): RequestedQueryWireEntry[] {
  const raw = formData.get(KIRU_REQUESTED_QUERIES_FIELD)
  if (typeof raw !== "string" || !raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? (parsed as RequestedQueryWireEntry[]).slice(0, MAX_CLIENT_REQUESTED_QUERIES)
      : []
  } catch {
    return []
  }
}

export function buildMutationWireBody(
  input: unknown,
  requested?: RequestedQueryWireEntry[]
): unknown {
  if (!requested?.length) {
    return input === undefined ? null : input
  }
  return {
    input: input === undefined ? null : input,
    requested,
  }
}
