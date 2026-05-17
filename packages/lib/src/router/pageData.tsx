import {
  STREAMED_DATA_DESCENDANTS,
  STREAMED_DATA_EVENT,
} from "../constants.js"

function escapeScriptJson(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export function serializePageDataScript(data: unknown): string {
  const json = escapeScriptJson(JSON.stringify(data))
  return `<script type="application/json" k-page-data>${json}</script>`
}

let hydratedPageData: unknown | undefined
let hydratedPageDataRead = false

/** Read SSR/SSG loader data embedded in the document (once per full load). */
export function readHydratedPageData(): unknown {
  if (typeof document === "undefined") return undefined
  if (hydratedPageDataRead) return hydratedPageData
  hydratedPageDataRead = true
  const el = document.querySelector("script[k-page-data]")
  if (!el) return undefined
  try {
    hydratedPageData = JSON.parse(el.textContent || "null")
    el.remove()
    return hydratedPageData
  } catch {
    el.remove()
    hydratedPageData = undefined
    return undefined
  }
}

/** Drop cached loader payload so CSR navigations fetch fresh data. */
export function resetHydratedPageData(): void {
  hydratedPageDataRead = false
  hydratedPageData = undefined
}

let initialSsrStreamPending: boolean | null = null

function isStreamedSsrClient(): boolean {
  if (typeof window === "undefined") return false
  const map = (window as unknown as Record<string, unknown>)[STREAMED_DATA_EVENT]
  return (
    map != null &&
    typeof map === "object" &&
    typeof (map as Map<string, unknown>).get === "function"
  )
}

/** True while the first SSR response may still deliver tail `__$k_data` scripts. */
export function isInitialSsrStreamPending(): boolean {
  if (initialSsrStreamPending === null) {
    initialSsrStreamPending = isStreamedSsrClient()
  }
  return initialSsrStreamPending
}

/** Drop streamed SSR payloads so CSR navigations refetch loaders/resources. */
export function clearStreamedSsrClientState(): void {
  if (typeof window === "undefined") return
  initialSsrStreamPending = false
  const w = window as unknown as Record<string, unknown>
  const cache = w[STREAMED_DATA_EVENT]
  if (cache instanceof Map) cache.clear()
  const announced = w[STREAMED_DATA_DESCENDANTS]
  if (announced instanceof Set) announced.clear()
}
