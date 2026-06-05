import { getRemoteAbortSignal } from "./abortScope.js"
import type { RemoteCallOptions } from "./remoteCallOptions.js"

export function resolveRemoteFetchSignal(
  explicit?: AbortSignal | RemoteCallOptions
): AbortSignal | undefined {
  const explicitSignal =
    explicit instanceof AbortSignal
      ? explicit
      : explicit?.signal
  const implicit = getRemoteAbortSignal()
  if (implicit && explicitSignal) {
    return AbortSignal.any([implicit, explicitSignal])
  }
  return explicitSignal ?? implicit
}
