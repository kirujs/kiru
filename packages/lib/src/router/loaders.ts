import type { CustomRequestContext } from "./types.js"
import type { RouterQuery } from "./requestUrl.js"
import type {
  EnforceLoaderValidation,
  InferSchemaOutput,
  KiruLoaderValidation,
  LoaderValidationConfig,
} from "./loaderValidation.js"
import { normalizeLoaderValidation } from "./loaderValidation.js"

export type {
  EnforceLoaderValidation,
  InferSchemaOutput,
  LoaderValidationConfig,
} from "./loaderValidation.js"

export interface LoaderContext {
  /** Dynamic path segments from the URL (always strings). */
  params: Record<string, string>
  url: {
    pathname: string
    search: string
    hash: string
  }
  /** Raw URL query (`?foo=bar&baz=1`). */
  query: RouterQuery
  context: CustomRequestContext
  request?: Request
}

export type LoaderContextFromValidation<V> = Omit<
  LoaderContext,
  "query" | "params"
> &
  (V extends { query: infer S }
    ? S extends import("../validation/index.js").Schema<infer _O>
      ? { query: InferSchemaOutput<S> }
      : { query: RouterQuery }
    : { query: RouterQuery }) &
  (V extends { params: infer S }
    ? S extends import("../validation/index.js").Schema<infer _O>
      ? { params: InferSchemaOutput<S> }
      : { params: Record<string, string> }
    : { params: Record<string, string> })

export type LoaderFn<T, Ctx extends LoaderContext = LoaderContext> = (
  ctx: Ctx
) => Promise<T> | T

export type LoaderKind = "server" | "static" | "universal" | "client"

export type KiruLoader<T = unknown> = {
  __kiruLoader: LoaderKind
  __kiruInvoke: (ctx: LoaderContext) => Promise<T>
  /** SSR/CSR fallback UI while load is in flight (serverLoader config only). */
  __kiruFallback?: (() => JSX.Element)
  __kiruValidation?: KiruLoaderValidation
}

/** `loader` / `clientLoader` config with {@link LoaderValidationConfig}. */
export type LoaderConfigWithValidation<
  T,
  V extends LoaderValidationConfig,
> = {
  validation: EnforceLoaderValidation<V>
  load: (ctx: LoaderContextFromValidation<V>) => Promise<T> | T
}

export type ServerLoaderConfig<T> = {
  load: LoaderFn<T>
  fallback: (() => JSX.Element)
}

export type ServerLoaderConfigWithValidation<
  T,
  V extends LoaderValidationConfig,
> = LoaderConfigWithValidation<T, V> & {
  fallback: (() => JSX.Element)
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

function wrapLoader<T>(
  kind: LoaderKind,
  fn: (ctx: LoaderContext) => Promise<T> | T,
  options?: {
    fallback?: (() => JSX.Element)
    validation?: KiruLoaderValidation
  }
): KiruLoader<T> {
  return {
    __kiruLoader: kind,
    __kiruInvoke: (ctx) => Promise.resolve(fn(ctx)),
    ...(options?.fallback !== undefined ? { __kiruFallback: options.fallback } : {}),
    ...(options?.validation !== undefined
      ? { __kiruValidation: options.validation }
      : {}),
  }
}

export function serverLoader<T>(fn: LoaderFn<T>): ServerLoader<T>
export function serverLoader<T>(config: ServerLoaderConfig<T>): ServerLoader<T>
export function serverLoader<
  T,
  const V extends LoaderValidationConfig,
>(config: ServerLoaderConfigWithValidation<T, V>): ServerLoader<T>
export function serverLoader<T, V extends LoaderValidationConfig>(
  fnOrConfig:
    | LoaderFn<T>
    | ServerLoaderConfig<T>
    | ServerLoaderConfigWithValidation<T, V>
): ServerLoader<T> {
  if (typeof fnOrConfig === "function") {
    return wrapLoader("server", fnOrConfig) as ServerLoader<T>
  }
  if ("validation" in fnOrConfig && fnOrConfig.validation) {
    const config = fnOrConfig as ServerLoaderConfigWithValidation<T, V>
    return wrapLoader(
      "server",
      (ctx) =>
        config.load(ctx as unknown as LoaderContextFromValidation<V>),
      {
        fallback: config.fallback,
        validation: normalizeLoaderValidation(config.validation),
      }
    ) as ServerLoader<T>
  }
  const config = fnOrConfig as ServerLoaderConfig<T>
  return wrapLoader("server", config.load, {
    fallback: config.fallback,
  }) as ServerLoader<T>
}

export function readLoaderFallback(
  load: KiruLoader | undefined
): (() => JSX.Element) | undefined {
  return load?.__kiruFallback
}

export function canStreamPageLoad(load: KiruLoader | undefined): boolean {
  return load?.__kiruLoader === "server" && load.__kiruFallback !== undefined
}

export function staticLoader<T>(fn: LoaderFn<T>): StaticLoader<T> {
  return wrapLoader("static", fn) as StaticLoader<T>
}

/**
 * Universal loader (SSR + client). Pass a function, or `{ validation, load }`
 * for typed `query` / `params` (see {@link LoaderValidationConfig}).
 */
export function loader<
  T,
  const V extends LoaderValidationConfig,
>(config: LoaderConfigWithValidation<T, V>): UniversalLoader<T>
export function loader<T>(fn: LoaderFn<T>): UniversalLoader<T>
export function loader<T, const V extends LoaderValidationConfig>(
  fnOrConfig: LoaderFn<T> | LoaderConfigWithValidation<T, V>
): UniversalLoader<T> {
  if (typeof fnOrConfig === "function") {
    return wrapLoader("universal", fnOrConfig) as UniversalLoader<T>
  }
  const validation = normalizeLoaderValidation(fnOrConfig.validation)
  return wrapLoader(
    "universal",
    (ctx) =>
      fnOrConfig.load(ctx as unknown as LoaderContextFromValidation<V>),
    { validation }
  ) as UniversalLoader<T>
}

export function clientLoader<
  T,
  const V extends LoaderValidationConfig,
>(config: LoaderConfigWithValidation<T, V>): ClientLoader<T>
export function clientLoader<T>(fn: LoaderFn<T>): ClientLoader<T>
export function clientLoader<T, const V extends LoaderValidationConfig>(
  fnOrConfig: LoaderFn<T> | LoaderConfigWithValidation<T, V>
): ClientLoader<T> {
  if (typeof fnOrConfig === "function") {
    return wrapLoader("client", fnOrConfig) as ClientLoader<T>
  }
  const validation = normalizeLoaderValidation(fnOrConfig.validation)
  return wrapLoader(
    "client",
    (ctx) =>
      fnOrConfig.load(ctx as unknown as LoaderContextFromValidation<V>),
    { validation }
  ) as ClientLoader<T>
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
