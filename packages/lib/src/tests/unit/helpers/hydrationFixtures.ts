import { serializeKDataScript } from "../../../router/dataRefs.js"

export const MINIMAL_STREAM_TPL =
  "<!doctype html><html><head>{{kiru_head}}</head><body>{{kiru_body}}</body></html>"

export const STREAM_TEST_SECRET = "test-stream-loader-query-secret"

export const feedSchema = {
  parse: (input: unknown) => {
    if (!input || typeof input !== "object") {
      return { sort: "hot" as const }
    }
    const record = input as { sort?: unknown; communitySlug?: unknown }
    const sort = record.sort === "new" ? ("new" as const) : ("hot" as const)
    const communitySlug =
      typeof record.communitySlug === "string" && record.communitySlug
        ? record.communitySlug
        : undefined
    return communitySlug === undefined
      ? { sort }
      : { sort, communitySlug }
  },
}

export async function readStreamHtml(
  response: { body: ReadableStream<string> | null }
): Promise<string> {
  const reader = (response.body as ReadableStream<string>).getReader()
  let html = ""
  while (true) {
    const next = await reader.read()
    if (next.done) break
    html += next.value
  }
  reader.releaseLock()
  return html
}

export function buildKDataHeadScripts(
  wireRef: string,
  data: unknown,
  pageData: Record<string, unknown>
): string {
  return (
    serializeKDataScript(wireRef, { data }) +
    `<script type="application/json" k-page-data>${JSON.stringify(pageData)}</script>`
  )
}

export async function waitForSelector(
  root: ParentNode,
  selector: string,
  timeoutMs = 3000
): Promise<Element | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const el = root.querySelector(selector)
    if (el) return el
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return root.querySelector(selector)
}
