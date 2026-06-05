export type RemoteCallOptions = {
  signal?: AbortSignal
}

export function isRemoteCallOptions(value: unknown): value is RemoteCallOptions {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  const o = value as RemoteCallOptions
  if (o.signal !== undefined && !(o.signal instanceof AbortSignal)) {
    return false
  }
  const keys = Object.keys(value)
  return keys.every((k) => k === "signal")
}

/** Peel trailing `{ signal }` from positional call args. */
export function peelRemoteCallArgs<T extends unknown[]>(
  args: T
): { callArgs: unknown[]; options?: RemoteCallOptions } {
  if (args.length === 0) return { callArgs: [] }
  const last = args[args.length - 1]
  if (!isRemoteCallOptions(last)) {
    return { callArgs: [...args] }
  }
  return {
    callArgs: args.slice(0, -1),
    options: last,
  }
}
