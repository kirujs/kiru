export const PAGE_DATA_SCRIPT_ID = "__kiru_page_data__"

function escapeScriptJson(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export function serializePageDataScript(data: unknown): string {
  const json = escapeScriptJson(JSON.stringify(data))
  return `<script id="${PAGE_DATA_SCRIPT_ID}" type="application/json">${json}</script>`
}

let hydratedPageData: unknown | undefined
let hydratedPageDataRead = false

/** Read SSR/SSG loader data embedded in the document (once per full load). */
export function readHydratedPageData(): unknown {
  if (typeof document === "undefined") return undefined
  if (hydratedPageDataRead) return hydratedPageData
  hydratedPageDataRead = true
  const el = document.getElementById(PAGE_DATA_SCRIPT_ID)
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
