import type { CustomRequestContext } from "./types.js"

export interface LoaderContext {
  params: Record<string, string>
  url: {
    pathname: string
    search: string
    hash: string
  }
  query: Record<string, string[]>
  context: CustomRequestContext
  request?: Request
}

export type LoaderFn<T> = (ctx: LoaderContext) => Promise<T> | T

export type LoaderKind = "server" | "static" | "universal" | "client"

export type KiruLoader<T = unknown> = {
  __kiruLoader: LoaderKind
  __kiruInvoke: (ctx: LoaderContext) => Promise<T>
}

export type ServerLoader<T> = KiruLoader<T> & { __kiruLoader: "server" }
export type StaticLoader<T> = KiruLoader<T> & { __kiruLoader: "static" }
export type UniversalLoader<T> = KiruLoader<T> & { __kiruLoader: "universal" }
export type ClientLoader<T> = KiruLoader<T> & { __kiruLoader: "client" }

/** Resolved data type from a route `load` export. */
export type LoaderData<T> = T extends KiruLoader<infer D>
  ? D
  : T extends LoaderFn<infer D>
    ? D
    : T

/**
 * Props passed to the page default export when the module defines `load`.
 * Loaders run before the page mounts; there is no loading state.
 */
export type PageProps<TLoader> =
  | { data: LoaderData<TLoader>; error: null }
  | { data: null; error: Error }

function wrapLoader<T>(kind: LoaderKind, fn: LoaderFn<T>): KiruLoader<T> {
  return {
    __kiruLoader: kind,
    __kiruInvoke: (ctx) => Promise.resolve(fn(ctx)),
  }
}

export function serverLoader<T>(fn: LoaderFn<T>): ServerLoader<T> {
  return wrapLoader("server", fn) as ServerLoader<T>
}

export function staticLoader<T>(fn: LoaderFn<T>): StaticLoader<T> {
  return wrapLoader("static", fn) as StaticLoader<T>
}

export function loader<T>(fn: LoaderFn<T>): UniversalLoader<T> {
  return wrapLoader("universal", fn) as UniversalLoader<T>
}

export function clientLoader<T>(fn: LoaderFn<T>): ClientLoader<T> {
  return wrapLoader("client", fn) as ClientLoader<T>
}

export function isKiruLoader(value: unknown): value is KiruLoader {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruLoader" in value &&
    typeof (value as KiruLoader).__kiruInvoke === "function"
  )
}

export function readPageLoadExport(mod: unknown): KiruLoader | undefined {
  if (!mod || typeof mod !== "object") return undefined
  const load = (mod as Record<string, unknown>).load
  return isKiruLoader(load) ? load : undefined
}
