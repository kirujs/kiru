import type { CustomRequestContext } from "../router/types.js"
import type { Schema } from "../validation/index.js"
import { parseInput } from "../validation/index.js"
import { RemoteError } from "./errors.js"

export type {
  ActionSchema,
  Schema,
  StandardJSONSchema,
  StandardJSONSchemaV1,
  StandardSchema,
  StandardSchemaV1,
  StandardSchemaWithJson,
} from "../validation/index.js"
export {
  isStandardJSONSchemaV1,
  isStandardSchemaV1,
  parseInput,
  toInputJsonSchema,
  toOutputJsonSchema,
} from "../validation/index.js"

export { RemoteError, isRemoteError } from "./errors.js"

// ---------------------------------------------------------------------------
// SSR request-context threading
// ---------------------------------------------------------------------------

/** Per-request context and abort signal passed to remote / form action handlers. */
export type RemoteActionContext = {
  context: CustomRequestContext
  signal: AbortSignal
}

import { getSsrActionContext, runWithSsrActionContext } from "./ssrActionScope.js"

export function buildRemoteActionContext(
  context: CustomRequestContext,
  signal: AbortSignal
): RemoteActionContext {
  return { context, signal }
}

/** Active SSR action context while inside a sync `runWithSsrRequestContext` scope. */
export function __getSsrActionContext(): RemoteActionContext {
  return getSsrActionContext()
}

/** Request context from the active SSR action scope. */
export function __getSsrRequestContext(): CustomRequestContext {
  return getSsrActionContext().context
}

/** Run synchronous SSR render work with action context (nested save/restore). */
export function runWithSsrRequestContext<T>(
  ctx: CustomRequestContext,
  signal: AbortSignal,
  fn: () => T
): T {
  return runWithSsrActionContext(ctx, signal, fn)
}

// ---------------------------------------------------------------------------
// Remote action (JSON)
// ---------------------------------------------------------------------------

export type RemoteActionMethod = "GET" | "POST"

export type RemoteActionCallback<Input, Output> = (
  ctx: RemoteActionContext,
  input: Input
) => Promise<Output> | Output

/** @deprecated Use {@link Schema} instead. */
export type RemoteActionSchema<Input> = Schema<Input>

export type RemoteActionOptions = {
  signal?: AbortSignal
}

export type RemoteGetAction<Output> = ((
  options?: RemoteActionOptions
) => Promise<Output>) & {
  __kiruRemoteAction: true
  __kiruRemoteMethod: "GET"
  __kiruInvoke: (ctx: RemoteActionContext, input: unknown) => Promise<Output>
}

export type RemoteRevalidateMeta = {
  paths?: string[]
  tags?: string[]
}

export type RemoteActionMeta = {
  /** Route ids to refetch loaders for after a successful invocation. */
  invalidate?: string[]
  /**
   * Prerender paths/tags to invalidate after success (server-only).
   * @see docs/router/tier-3-wave-1.md#on-demand-revalidation
   */
  revalidate?: RemoteRevalidateMeta
}

/** First argument to {@link action.post} when schema, meta, or form encoding is needed. */
export type RemotePostConfig<Input = unknown> = {
  /** `"form"` for native / progressive-enhancement forms; default `"json"`. */
  type?: "json" | "form"
  schema?: Schema<Input>
} & RemoteActionMeta

export type RemotePostAction<Input, Output> = ((
  input: Input,
  options?: RemoteActionOptions
) => Promise<Output>) & {
  __kiruRemoteAction: true
  __kiruRemoteMethod: "POST"
  __kiruInvoke: (ctx: RemoteActionContext, input: unknown) => Promise<Output>
  __kiruInvalidateRoutes?: string[]
  __kiruRevalidate?: RemoteRevalidateMeta
}

export type RemoteActionFunction<Input, Output> =
  | RemoteGetAction<Output>
  | RemotePostAction<Input, Output>

type GetCallback<Output> =
  | ((ctx: RemoteActionContext) => Promise<Output> | Output)
  | (() => Promise<Output> | Output)

function wrapGetCallback<Output>(
  callback: GetCallback<Output>
): (ctx: RemoteActionContext) => Promise<Output> | Output {
  if (callback.length === 0) {
    return () => (callback as () => Promise<Output> | Output)()
  }
  return callback as (ctx: RemoteActionContext) => Promise<Output> | Output
}

function createRemoteAction<Input, Output>(
  method: RemoteActionMethod,
  runAction: RemoteActionCallback<Input, Output>,
  validateActionInput: (input: unknown) => void | Promise<void>,
  meta?: RemoteActionMeta
): RemoteGetAction<Output> | RemotePostAction<Input, Output> {
  if (method === "GET") {
    const wrapped = (async (_options?: RemoteActionOptions): Promise<Output> => {
      const ctx = getSsrActionContext()
      await validateActionInput(undefined)
      return runAction(ctx, undefined as Input)
    }) as RemoteGetAction<Output>

    wrapped.__kiruRemoteAction = true
    wrapped.__kiruRemoteMethod = "GET"
    wrapped.__kiruInvoke = async (ctx, _input) => {
      await validateActionInput(undefined)
      return runAction(ctx, undefined as Input)
    }
    return wrapped
  }

  const wrapped = (async (
    input: Input,
    _options?: RemoteActionOptions
  ): Promise<Output> => {
    const ctx = getSsrActionContext()
    await validateActionInput(input)
    return runAction(ctx, input)
  }) as RemotePostAction<Input, Output>

  wrapped.__kiruRemoteAction = true
  wrapped.__kiruRemoteMethod = "POST"
  if (meta?.invalidate?.length) {
    wrapped.__kiruInvalidateRoutes = meta.invalidate
  }
  if (meta?.revalidate) {
    wrapped.__kiruRevalidate = meta.revalidate
  }
  wrapped.__kiruInvoke = async (ctx, input) => {
    await validateActionInput(input)
    return runAction(ctx, input as Input)
  }
  return wrapped
}

function metaFromConfig(config: RemotePostConfig<unknown>): RemoteActionMeta {
  return {
    invalidate: config.invalidate,
    revalidate: config.revalidate,
  }
}

function createJsonPostAction<Input, Output>(
  runAction: RemoteActionCallback<Input, Output>,
  schema?: Schema<Input>,
  meta?: RemoteActionMeta
): RemotePostAction<Input, Output> {
  const validateActionInput = async (input: unknown) => {
    if (!schema) return
    try {
      await parseInput(schema, input)
    } catch {
      throw new RemoteError("Invalid remote action input", "INVALID_INPUT", {
        status: 400,
      })
    }
  }
  return createRemoteAction(
    "POST",
    runAction,
    validateActionInput,
    meta
  ) as RemotePostAction<Input, Output>
}

function createFormPostAction<Input, Output>(
  config: RemotePostConfig<Input>,
  callback:
    | RemoteFormActionCallback<Output>
    | RemoteActionCallback<Input, Output>
): RemoteFormActionFunction<Output> {
  const meta = metaFromConfig(config)
  const schema = config.schema

  const __kiruInvoke = schema
    ? async (ctx: RemoteActionContext, formData: FormData) => {
        const raw = formDataToInput(formData)
        let input: Input
        try {
          input = await parseInput(schema, raw)
        } catch {
          throw new RemoteError("Invalid remote action input", "INVALID_INPUT", {
            status: 400,
          })
        }
        return Promise.resolve(
          (callback as RemoteActionCallback<Input, Output>)(ctx, input)
        )
      }
    : (ctx: RemoteActionContext, formData: FormData) =>
        Promise.resolve(
          (callback as RemoteFormActionCallback<Output>)(ctx, formData)
        )

  return {
    __kiruFormAction: true,
    __kiruFormActionId: "",
    __kiruInvalidateRoutes: meta.invalidate,
    __kiruRevalidate: meta.revalidate,
    __kiruInvoke,
  }
}

function post<Input, Output>(
  callback: RemoteActionCallback<Input, Output>
): RemotePostAction<Input, Output>
function post<Output>(
  config: { type: "form"; schema?: undefined } & RemoteActionMeta,
  callback: RemoteFormActionCallback<Output>
): RemoteFormActionFunction<Output>
function post<Input, Output>(
  config: { type: "form"; schema: Schema<Input> } & RemoteActionMeta,
  callback: RemoteActionCallback<Input, Output>
): RemoteFormActionFunction<Output>
function post<Input, Output>(
  config: RemotePostConfig<Input>,
  callback: RemoteActionCallback<Input, Output>
): RemotePostAction<Input, Output>
function post<Input, Output>(
  callbackOrConfig:
    | RemoteActionCallback<Input, Output>
    | RemotePostConfig<Input>,
  maybeCallback?:
    | RemoteFormActionCallback<Output>
    | RemoteActionCallback<Input, Output>
):
  | RemotePostAction<Input, Output>
  | RemoteFormActionFunction<Output> {
  if (typeof callbackOrConfig === "function") {
    return createJsonPostAction(callbackOrConfig)
  }
  const config = callbackOrConfig
  const callback = maybeCallback
  if (!callback) {
    throw new Error("action.post(config, callback) requires a handler")
  }
  if (config.type === "form") {
    return createFormPostAction(config, callback)
  }
  return createJsonPostAction(
    callback as RemoteActionCallback<Input, Output>,
    config.schema,
    metaFromConfig(config)
  )
}

export const action = {
  get<Output>(callback: GetCallback<Output>): RemoteGetAction<Output> {
    const run = wrapGetCallback(callback)
    const runAction: RemoteActionCallback<void, Output> = (ctx, _input) =>
      Promise.resolve(run(ctx))
    return createRemoteAction("GET", runAction, () => {}) as RemoteGetAction<Output>
  },
  post,
}

// ---------------------------------------------------------------------------
// Form action (multipart / urlencoded POST)
// ---------------------------------------------------------------------------

/** Hidden field name injected into native `<form>` elements for the signed context token. */
export const KIRU_FORM_TOKEN_FIELD = "__kiru_token" as const

/** Returned by {@link redirect} inside a form action callback to trigger a server-side redirect. */
export type KiruRedirect = {
  readonly __kiruRedirect: true
  readonly status: number
  readonly location: string
}

/** Create a redirect response from inside an `action.post({ type: "form" }, …)` callback. */
export function redirect(status: number, location: string): KiruRedirect {
  return { __kiruRedirect: true, status, location }
}

export function isKiruRedirect(value: unknown): value is KiruRedirect {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruRedirect" in value &&
    (value as { __kiruRedirect: unknown }).__kiruRedirect === true
  )
}

export type RemoteFormActionCallback<Output> = (
  ctx: RemoteActionContext,
  formData: FormData
) => Promise<Output> | Output

/**
 * Typed handle for a form action.
 * - On the server the full object (including `__kiruInvoke`) is present.
 * - On the client the vite plugin replaces the runtime value with
 *   `{ __kiruFormAction: true, __kiruFormActionId: "<routeId>:<name>" }`
 *   while TypeScript continues to see this type, enabling `Output` inference
 *   in {@link createFormController} via the `__kiruInvoke` return type.
 */
export type RemoteFormActionFunction<Output> = {
  readonly __kiruFormAction: true
  __kiruFormActionId: string
  __kiruInvalidateRoutes?: string[]
  __kiruRevalidate?: RemoteRevalidateMeta
  __kiruInvoke: (
    ctx: RemoteActionContext,
    formData: FormData
  ) => Promise<Output>
}

/** Convert {@link FormData} to a plain object for schema validation (preserves File/Blob). */
export function formDataToInput(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (key === KIRU_FORM_TOKEN_FIELD) continue
    const existing = result[key]
    if (existing === undefined) {
      result[key] = value
    } else if (Array.isArray(existing)) {
      existing.push(value)
    } else {
      result[key] = [existing, value]
    }
  }
  return result
}
