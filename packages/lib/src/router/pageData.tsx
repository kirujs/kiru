import {
  STREAMED_DATA_DESCENDANTS,
  STREAMED_DATA_EVENT,
  STREAM_BOOTSTRAP_COMPLETE,
} from "../constants.js"
import { __DEV__ } from "../env.js"
import { renderMode } from "../globals.js"
import {
  buildPageDataPayloadFromRegistry,
  collectInjectedQueryScriptTags,
} from "../ssr/queryInjection.js"
import {
  escapeScriptJson,
  parseKDataScriptsFromDocument,
  resolveRefsInValue,
  resolveStreamRefPayload,
  seedQueryCacheFromKDataStore,
} from "./dataRefs.js"
import { seedQueriesFromPayload } from "../remote/pageDataQueries.js"
import type { KiruLoader, PageProps } from "./loaders.js"

export function serializePageDataScript(data: unknown): string {
  const json = escapeScriptJson(JSON.stringify(data))
  return `<script type="application/json" k-page-data>${json}</script>`
}

let streamPageDataEmitter: ((script: string) => void) | null = null

/** Wire tail-stream injection for streaming load-gate pages (see {@link registerStreamPageLoadResult}). */
export function setStreamPageDataEmitter(
  fn: ((script: string) => void) | null
): void {
  streamPageDataEmitter = fn
}

/** Embed loader output for client hydrate when streaming SSR skips head `k-page-data`. */
export function registerStreamPageLoadResult(data: unknown): void {
  if (typeof window !== "undefined" || !streamPageDataEmitter) return
  streamPageDataEmitter(serializePageDataScript(data))
}

/** Serialize canonical k-data scripts plus k-page-data for document head. */
export function serializePageDataHeadScripts(pageData: unknown): string {
  const resolvedPageData =
    typeof window === "undefined" && pageData !== undefined
      ? buildPageDataPayloadFromRegistry(pageData)
      : pageData
  const kDataScripts =
    typeof window === "undefined" ? collectInjectedQueryScriptTags() : ""
  const pageDataScript =
    resolvedPageData !== undefined
      ? serializePageDataScript(resolvedPageData)
      : ""
  if (kDataScripts && pageDataScript) {
    return `${kDataScripts}\n    ${pageDataScript}`
  }
  return kDataScripts || pageDataScript
}

let hydratedPageData: unknown | undefined
let hydratedPageDataRead = false

/** Read SSR/SSG loader data embedded in the document (once per full load). */
export function readHydratedPageData(): unknown {
  if (typeof document === "undefined") return undefined
  if (hydratedPageDataRead) return hydratedPageData
  hydratedPageDataRead = true

  const kDataStore = parseKDataScriptsFromDocument({ headOnly: true })
  seedQueryCacheFromKDataStore(kDataStore)

  const el = document.querySelector("script[k-page-data]")
  if (!el) return undefined
  try {
    const parsed: unknown = JSON.parse(el.textContent || "null")
    hydratedPageData = seedQueriesFromPayload(
      resolveRefsInValue(parsed, kDataStore)
    )
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
  const map = Reflect.get(window, STREAMED_DATA_EVENT)
  return map instanceof Map
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
  const cache = Reflect.get(window, STREAMED_DATA_EVENT)
  if (cache instanceof Map) cache.clear()
  const announced = Reflect.get(window, STREAMED_DATA_DESCENDANTS)
  if (announced instanceof Set) announced.clear()
}

let buildingInitialSsrOutlet = false

export type SsrHydratePhase =
  | "idle"
  | "buildingOutlet"
  | "hydrating"
  | "streamPending"

/** Current SSR client bootstrap phase (priority: buildingOutlet > hydrating > streamPending). */
export function getSsrHydratePhase(): SsrHydratePhase {
  if (buildingInitialSsrOutlet) return "buildingOutlet"
  if (typeof window !== "undefined" && renderMode.current === "hydrate") {
    return "hydrating"
  }
  if (isInitialSsrStreamPending()) return "streamPending"
  return "idle"
}

/** True during initial SSR client bootstrap (outlet build or hydrate render). */
export function isSsrHydrateBootstrap(): boolean {
  const phase = getSsrHydratePhase()
  return phase === "buildingOutlet" || phase === "hydrating"
}

/** True while {@link buildInitialSsrOutletInShell} is building the initial subtree. */
export function isBuildingInitialSsrOutlet(): boolean {
  return getSsrHydratePhase() === "buildingOutlet"
}

/** True while tail `__$k_data` scripts may still arrive. */
export function isAwaitingStreamTail(): boolean {
  return isInitialSsrStreamPending()
}

/** True while {@link buildInitialSsrOutletInShell} is building the initial subtree. */
export function setBuildingInitialSsrOutlet(value: boolean): void {
  buildingInitialSsrOutlet = value
  if (value) {
    initialSsrStreamPending = null
  }
}
export type StreamBootstrapSnapshot = {
  serverStreamIds: string[]
  replayed: string[]
}

declare global {
  interface Window {
    __kiruStreamBootstrap?: StreamBootstrapSnapshot
    /** Injected by streaming SSR shell before tail `__$k_data` callsites run. */
    __$k_data?: (
      id: string,
      payload: { data?: unknown; error?: string },
      ...descendants: string[]
    ) => void
  }
}

export function parseStreamCallsiteFromScript(text: string): {
  id: string
  payload: { data?: unknown; error?: string }
} | null {
  const marker = '__$k_data("'
  const start = text.indexOf(marker)
  if (start < 0) return null
  const idStart = start + marker.length
  const idEnd = text.indexOf('"', idStart)
  if (idEnd < 0) return null
  const id = text.slice(idStart, idEnd)
  const jsonStart = text.indexOf("{", idEnd)
  if (jsonStart < 0) return null
  let depth = 0
  for (let i = jsonStart; i < text.length; i++) {
    const ch = text[i]
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) {
        try {
          return {
            id,
            payload: JSON.parse(text.slice(jsonStart, i + 1)) as {
              data?: unknown
              error?: string
            },
          }
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function isPagePropsShape(
  value: unknown
): value is PageProps<KiruLoader<unknown>> {
  return (
    value != null &&
    typeof value === "object" &&
    "data" in value &&
    "error" in value
  )
}

function pagePropsFromStreamPayload(payload: {
  data?: unknown
  error?: string
}): PageProps<KiruLoader<unknown>> | undefined {
  const resolved = resolveStreamRefPayload(payload)
  if (!resolved || resolved.error) return undefined
  if (isPagePropsShape(resolved.data)) return resolved.data
  return undefined
}

/** Read loader page props from streamed tail scripts and the deferred cache. */
export function readStreamedPagePropsForHydrate():
  | PageProps<KiruLoader<unknown>>
  | undefined {
  if (typeof window === "undefined") return undefined
  ingestPendingStreamScriptsFromDocument()
  const cache = Reflect.get(window, STREAMED_DATA_EVENT)
  if (cache instanceof Map && cache.size > 0) {
    for (const payload of cache.values()) {
      const props = pagePropsFromStreamPayload(
        payload as { data?: unknown; error?: string }
      )
      if (props) return props
    }
  }
  for (const script of document.querySelectorAll("script")) {
    const text = script.textContent ?? ""
    if (!text.includes('__$k_data("')) continue
    const parsed = parseStreamCallsiteFromScript(text)
    if (!parsed) continue
    const props = pagePropsFromStreamPayload(parsed.payload)
    if (props) return props
  }
  return undefined
}

/**
 * Tail stream scripts can appear in the document after `</html>` while the async
 * client module is already bootstrapping. Execute any not-yet-run callsites so the
 * deferred cache matches what a fully-closed stream response would have produced.
 */
export function ingestPendingStreamScriptsFromDocument(): void {
  if (typeof window === "undefined") return
  const cache = Reflect.get(window, STREAMED_DATA_EVENT)
  if (!(cache instanceof Map)) return

  const announced = Reflect.get(window, STREAMED_DATA_DESCENDANTS)
  const announcedSet = announced instanceof Set ? announced : undefined
  const invoke = window.__$k_data

  for (const script of document.querySelectorAll("script")) {
    const text = script.textContent ?? ""
    if (!text.includes('__$k_data("')) continue

    const parsed = parseStreamCallsiteFromScript(text)
    if (!parsed) continue

    const id = parsed.id
    if (cache.has(id)) {
      script.remove()
      continue
    }

    const payload = parsed.payload

    if (typeof invoke === "function") {
      invoke(id, payload)
    } else {
      cache.set(id, payload)
      announcedSet?.add(id)
      window.dispatchEvent(
        new window.CustomEvent(STREAMED_DATA_EVENT, {
          detail: { id, ...payload },
        })
      )
      script.remove()
    }
  }
}

/** Replay tail `__$k_data` cache entries to pending resource listeners after hydrate. */
export function replayInitialStreamedResources(): void {
  if (typeof window === "undefined") return
  ingestPendingStreamScriptsFromDocument()
  const cache = Reflect.get(window, STREAMED_DATA_EVENT)
  if (!(cache instanceof Map)) return

  const serverStreamIds = [...cache.keys()].filter(
    (id): id is string => typeof id === "string"
  )
  const replayed: string[] = []

  for (const id of serverStreamIds) {
    const payload = cache.get(id)
    if (payload === undefined) continue
    replayed.push(id)
    window.dispatchEvent(
      new window.CustomEvent(STREAMED_DATA_EVENT, {
        detail: { id, ...payload },
      })
    )
  }

  if (__DEV__) {
    window.__kiruStreamBootstrap = { serverStreamIds, replayed }
  }

  initialSsrStreamPending = false
  window.dispatchEvent(new window.CustomEvent(STREAM_BOOTSTRAP_COMPLETE))
}

/** Ingest tail scripts, optionally seed head k-data, and replay deferred resources. */
export function bootstrapStreamedHydration(options?: {
  ingest?: boolean
  seedKData?: boolean
  replay?: boolean
}): void {
  if (typeof window === "undefined") return
  const ingest = options?.ingest !== false
  const seedKData = options?.seedKData === true
  const replay = options?.replay !== false
  if (ingest) ingestPendingStreamScriptsFromDocument()
  if (seedKData) {
    seedQueryCacheFromKDataStore(parseKDataScriptsFromDocument())
  }
  if (replay) replayInitialStreamedResources()
}
