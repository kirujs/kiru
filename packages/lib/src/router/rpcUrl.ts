import { addBase, normalizeBaseUrl } from "./pathPolicy.js"
import { getActiveRouter } from "./routerGlobal.js"

function resolveRpcBaseUrl(baseUrl?: string): string {
  return normalizeBaseUrl(baseUrl ?? getActiveRouter()?.baseUrl ?? "/")
}

/** Client loader RPC URL (`POST`, `?loader=routeId:load`). */
export function buildLoaderRpcUrl(routeId: string, baseUrl?: string): string {
  const path = addBase("/", resolveRpcBaseUrl(baseUrl))
  return `${path}?loader=${encodeURIComponent(`${routeId}:load`)}`
}

/** Client query RPC URL (`POST`, `?query=…`). Body carries input JSON. */
export function buildQueryRpcUrl(remoteId: string, baseUrl?: string): string {
  const path = addBase("/", resolveRpcBaseUrl(baseUrl))
  return `${path}?query=${encodeURIComponent(remoteId)}`
}

/** Client mutation / form RPC URL (`POST`, `?mutation=…`). */
export function buildMutationRpcUrl(
  remoteId: string,
  baseUrl?: string
): string {
  const path = addBase("/", resolveRpcBaseUrl(baseUrl))
  return `${path}?mutation=${encodeURIComponent(remoteId)}`
}

