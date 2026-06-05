export { resolveRemoteFetchSignal } from "./resolveRemoteFetchSignal.js"

/** Active implicit abort while inside loader / resource / in-process remote scope. */
let activeRemoteAbortSignal: AbortSignal | undefined

export const remoteCallContext = {
  get abortSignal(): AbortSignal | undefined {
    return activeRemoteAbortSignal
  },
}

export function getRemoteAbortSignal(): AbortSignal | undefined {
  return activeRemoteAbortSignal
}

export function runWithRemoteAbortSignal<T>(
  signal: AbortSignal | undefined,
  fn: () => T
): T {
  const prev = activeRemoteAbortSignal
  if (signal != null) activeRemoteAbortSignal = signal
  try {
    return fn()
  } finally {
    activeRemoteAbortSignal = prev
  }
}

export async function runWithRemoteAbortSignalAsync<T>(
  signal: AbortSignal | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const prev = activeRemoteAbortSignal
  if (signal != null) activeRemoteAbortSignal = signal
  try {
    return await fn()
  } finally {
    activeRemoteAbortSignal = prev
  }
}
