import type { LoaderContext } from "./loaders.js"
import { isKiruLoader, readPageLoadExport } from "./loaders.js"
import { __DEV__ } from "../env.js"
import { warnOnce } from "./devWarnings.dev.js"

/** Per-path loader data baked into a page module at SSG build time. */
export type StaticLoaderPayloadByPath = Record<string, unknown>

export const STATIC_LOADER_PAYLOAD_EXPORT = "__kiruStaticLoaderPayload"

export type StaticLoaderPrerenderCapture = {
  /** Manifest route id (`route:N`). */
  routeId: string
  /** Public URL path (includes locale prefix when applicable). */
  pathname: string
  pageData: unknown
}

type StaticLoaderCaptureListener = (capture: StaticLoaderPrerenderCapture) => void

const captureListeners = new Set<StaticLoaderCaptureListener>()

/** Register a listener for static loader results during `prerenderStaticRoutes`. */
export function onStaticLoaderPrerenderCapture(
  listener: StaticLoaderCaptureListener
): () => void {
  captureListeners.add(listener)
  return () => {
    captureListeners.delete(listener)
  }
}

export function emitStaticLoaderPrerenderCapture(
  capture: StaticLoaderPrerenderCapture
): void {
  for (const listener of captureListeners) {
    listener(capture)
  }
}

export function buildStaticLoaderLookupKey(ctx: LoaderContext): string {
  return `${ctx.url.pathname}${ctx.url.search}`
}

export function readPageStaticLoaderPayload(
  mod: unknown
): StaticLoaderPayloadByPath | undefined {
  if (!mod || typeof mod !== "object") return undefined
  const payload = (mod as Record<string, unknown>)[STATIC_LOADER_PAYLOAD_EXPORT]
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined
  }
  return payload as StaticLoaderPayloadByPath
}

export function resolveStaticLoaderDataFromModule(
  mod: unknown,
  ctx: LoaderContext
): unknown {
  const payload = readPageStaticLoaderPayload(mod)
  if (!payload) {
    if (__DEV__) {
      warnOnce(
        "static-loader-missing-payload-export",
        `[kiru/router] Page module is missing \`export const ${STATIC_LOADER_PAYLOAD_EXPORT}\`. Rebuild the SSG app.`
      )
    }
    return undefined
  }
  const key = buildStaticLoaderLookupKey(ctx)
  const data = payload[key]
  if (data === undefined && __DEV__) {
    warnOnce(
      `static-loader-missing-path-${key}`,
      `[kiru/router] No static loader data for "${key}" in this page module.`
    )
  }
  return data
}

export function pageModuleUsesStaticLoader(mod: unknown): boolean {
  const load = readPageLoadExport(mod)
  return !!load && isKiruLoader(load) && load.__kiruLoader === "static"
}
