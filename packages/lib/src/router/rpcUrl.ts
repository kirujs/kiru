import { addBase, normalizeBaseUrl } from "./pathPolicy.js"
import { getKiruRouter } from "./routerGlobal.js"

function resolveRpcBaseUrl(baseUrl?: string): string {
  return normalizeBaseUrl(baseUrl ?? getKiruRouter()?.baseUrl ?? "/")
}

/** Client loader RPC URL (`POST`, `?loader=routeId:load`). */
export function buildLoaderRpcUrl(routeId: string, baseUrl?: string): string {
  const path = addBase("/", resolveRpcBaseUrl(baseUrl))
  return `${path}?loader=${encodeURIComponent(`${routeId}:load`)}`
}

/**
 * Client action RPC URL (`POST`, `?action=…`).
 * @param queryString Serialized query (no leading `?`), appended after `action=`.
 */
export function buildActionRpcUrl(
  actionId: string,
  baseUrl?: string,
  queryString?: string
): string {
  const path = addBase("/", resolveRpcBaseUrl(baseUrl))
  const core = `${path}?action=${encodeURIComponent(actionId)}`
  return queryString ? `${core}&${queryString}` : core
}
