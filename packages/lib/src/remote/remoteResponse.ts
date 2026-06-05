import { requestToken } from "../globals.js"
import { KIRU_TOKEN_RESPONSE_HEADER } from "./remoteHeaders.js"
import { applyQueryPatches } from "./queryCache.js"
import { readQueryPatches } from "./rpcJson.js"
import { KIRU_QUERY_PATCHES_KEY, type KiruQueryPatch } from "./queryPatch.js"

/** Apply framework response headers and optional JSON envelope patches. */
export function applyRemoteResponsePayload(
  headers: Headers,
  json: unknown
): void {
  const token = headers.get(KIRU_TOKEN_RESPONSE_HEADER)
  if (token) requestToken.setCurrent(token)

  const patches = readQueryPatches(json)
  if (patches) {
    applyQueryPatches(patches)
  }
}

export function attachQueryPatchesToPayload<T>(
  payload: T,
  patches: readonly KiruQueryPatch[]
): T | (T & { __kiruQueryPatches: KiruQueryPatch[] }) {
  if (!patches.length) return payload
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      ...(payload as object),
      [KIRU_QUERY_PATCHES_KEY]: [...patches],
    } as T & { __kiruQueryPatches: KiruQueryPatch[] }
  }
  return {
    data: payload,
    [KIRU_QUERY_PATCHES_KEY]: [...patches],
  } as unknown as T & { __kiruQueryPatches: KiruQueryPatch[] }
}
