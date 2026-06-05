import { requestToken } from "../globals.js"
import { __DEV__, __KIRU_PURE_CLIENT__ } from "../env.js"
import { buildMutationRpcUrl, buildQueryRpcUrl } from "../router/rpcUrl.js"
import { applyRemoteResponsePayload } from "./remoteResponse.js"
import { RemoteDispatchError } from "./errors.js"
import { REMOTE_PURE_CLIENT_DEV_MSG } from "../router/devWarnings.dev.js"
import { buildRemoteRpcHeaders } from "./remoteRequestHeaders.js"
import { resolveRemoteFetchSignal } from "./abortScope.js"
import type { RemoteCallOptions } from "./remoteCallOptions.js"
import {
  readKiruRedirect,
  readQueryPatches,
  unwrapPatchedRpcBody,
} from "./rpcJson.js"

function assertClientRpcAvailable(): void {
  if (__DEV__ && __KIRU_PURE_CLIENT__) {
    throw new RemoteDispatchError(500, REMOTE_PURE_CLIENT_DEV_MSG)
  }
}

export async function dispatchQueryRpc(
  queryId: string,
  input: unknown,
  options?: RemoteCallOptions
): Promise<unknown> {
  assertClientRpcAvailable()
  const signal = resolveRemoteFetchSignal(options)
  const r = await fetch(buildQueryRpcUrl(queryId), {
    method: "POST",
    signal,
    headers: buildRemoteRpcHeaders(requestToken.current),
    body: JSON.stringify(input === undefined ? null : input),
  })
  return parseJsonRpcResponse(r)
}

export async function dispatchMutationRpc(
  mutationId: string,
  body: unknown,
  options?: RemoteCallOptions
): Promise<unknown> {
  assertClientRpcAvailable()
  const signal = resolveRemoteFetchSignal(options)
  const r = await fetch(buildMutationRpcUrl(mutationId), {
    method: "POST",
    signal,
    headers: buildRemoteRpcHeaders(requestToken.current),
    body: JSON.stringify(body === undefined ? null : body),
  })
  return parseJsonRpcResponse(r)
}

async function parseJsonRpcResponse(res: Response): Promise<unknown> {
  applyRemoteResponsePayload(res.headers, undefined)

  if (!res.ok) {
    throw new RemoteDispatchError(res.status || 500, "Remote call failed")
  }

  const text = await res.text()
  if (!text) return undefined

  let data: unknown
  try {
    data = JSON.parse(text) as unknown
  } catch {
    throw new RemoteDispatchError(500, "Invalid remote response")
  }

  const patches = readQueryPatches(data)
  if (patches) {
    const { applyQueryPatches } = await import("./queryCache.js")
    applyQueryPatches(patches)
    return unwrapPatchedRpcBody(data)
  }

  applyRemoteResponsePayload(res.headers, data)

  const redirect = readKiruRedirect(data)
  if (redirect) {
    if (typeof window !== "undefined") {
      window.location.assign(
        new URL(redirect.location, window.location.href).href
      )
    }
    return undefined
  }

  return data
}
