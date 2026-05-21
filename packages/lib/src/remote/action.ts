import type { CustomRequestContext } from "../router/types.js"
import type { Schema } from "../validation/index.js"
import { parseInput } from "../validation/index.js"
import { RemoteError } from "./errors.js"
import {
  getActiveActionContext,
  getActiveActionExecution,
  runWithActionFrame,
  toRemoteActionHandlerArgs,
} from "./actionInvokeScope.js"
import {
  getSsrActionScopeEntry,
  runWithSsrActionContext,
} from "./ssrActionScope.js"

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

import type { ActionExecution } from "./actionExecution.js"

export type {
  ActionExecution,
  ActionExecutionFrame,
  RequestExecutionContext,
  ActionRuntimeContext,
  CacheScope,
  TraceContext,
  TraceSpan,
  Transaction,
  CreateActionExecutionOptions,
} from "./actionExecution.js"
export {
  createActionExecution,
  createActionFrame,
  createCacheScope,
  createTraceContext,
  listActionFrames,
} from "./actionExecution.js"

/** Arguments passed to remote action handlers (and nested `__kiruInvoke`). */
export type RemoteActionHandlerArgs<Input> = {
  input: Input
  context: CustomRequestContext
  signal: AbortSignal
  /** Request runtime (frames, cache, tracing). Set during RPC and nested composition. */
  execution?: ActionExecution
}

/** Registry / HTTP entry invoke shape (input is unknown at the boundary). */
export type RemoteActionInvokeArgs = {
  input: unknown
  context: CustomRequestContext
  signal: AbortSignal
  execution?: ActionExecution
}

export function buildRemoteActionHandlerArgs<Input>(
  context: CustomRequestContext,
  signal: AbortSignal,
  input: Input,
  execution?: ActionExecution
): RemoteActionHandlerArgs<Input> {
  return { input, context, signal, execution }
}

/** Active SSR handler args while inside a sync `runWithSsrRequestContext` scope. */
export function __getSsrActionContext(): RemoteActionHandlerArgs<void> {
  const entry = getSsrActionScopeEntry()
  if (!entry) {
    return buildRemoteActionHandlerArgs(
      {},
      new AbortController().signal,
      undefined
    )
  }
  return buildRemoteActionHandlerArgs(
    entry.context,
    entry.signal,
    undefined
  )
}

/** Request context from the active SSR action scope. */
export function __getSsrRequestContext(): CustomRequestContext {
  return __getSsrActionContext().context
}

/** Run synchronous SSR render work with action context (nested save/restore). */
export function runWithSsrRequestContext<T>(
  ctx: CustomRequestContext,
  signal: AbortSignal,
  fn: () => T
): T {
  return runWithSsrActionContext(ctx, signal, fn)
}

function resolveCallableHandlerArgs<Input>(
  input: Input,
  call?: RemoteActionCallOptions<Input>
): RemoteActionHandlerArgs<Input> {
  const active = getActiveActionContext()
  if (active) {
    const signal = call?.signal ?? active.signal
    return {
      input,
      context: active.context,
      signal,
      execution: active.execution,
    }
  }
  const ssr = getSsrActionScopeEntry()
  if (ssr) {
    const signal = call?.signal ?? ssr.signal
    return buildRemoteActionHandlerArgs(ssr.context, signal, input)
  }
  throw new Error(
    "Remote action called without request context. Use during SSR render, inside another action handler, or from the client (after hydration)."
  )
}

async function awaitActionValidation(
  validate: (input: unknown) => void | Promise<void>,
  input: unknown
): Promise<void> {
  const result = validate(input)
  if (result != null && typeof (result as Promise<void>).then === "function") {
    await result
  }
}

function dispatchCallableInvoke<Input, Output>(
  runHandler: RemoteActionHandler<Input, Output>,
  args: RemoteActionHandlerArgs<Input>,
  actionId?: string
): Promise<Output> {
  const execution = getActiveActionExecution()
  if (execution && actionId) {
    return Promise.resolve(
      runWithActionFrame(actionId, () =>
        runHandler(toRemoteActionHandlerArgs(execution, args.input))
      )
    )
  }
  return Promise.resolve(runHandler(args))
}

// ---------------------------------------------------------------------------
// Remote action (JSON)
// ---------------------------------------------------------------------------

export type RemoteActionMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"

const BODY_METHODS = new Set<RemoteActionMethod>([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
])

export function isRemoteActionBodyMethod(
  method: RemoteActionMethod
): method is "POST" | "PUT" | "PATCH" | "DELETE" {
  return BODY_METHODS.has(method)
}

export type RemoteActionHandler<Input, Output> = (
  args: RemoteActionHandlerArgs<Input>
) => Promise<Output> | Output

export type RemoteActionCallOptions<Input> = [Input] extends [void]
  ? { signal?: AbortSignal }
  : { input: Input; signal?: AbortSignal }

type RemoteCallable<Input, Output> = [Input] extends [void]
  ? (options?: RemoteActionCallOptions<void>) => Promise<Output>
  : (options: RemoteActionCallOptions<Input>) => Promise<Output>

type RemoteActionBrand<Method extends RemoteActionMethod> = {
  __kiruRemoteAction: true
  __kiruRemoteMethod: Method
  /** RPC id (`routeId:export.path`) for frame stack / tracing. */
  __kiruActionId?: string
  __kiruInvoke: (args: RemoteActionInvokeArgs) => Promise<unknown>
  __kiruInvalidateRoutes?: string[]
  __kiruRevalidate?: RemoteRevalidateMeta
}

export type RemoteGetAction<Output> = RemoteCallable<void, Output> &
  RemoteActionBrand<"GET">

export type RemoteBodyAction<
  Method extends "POST" | "PUT" | "PATCH" | "DELETE",
  Input,
  Output,
> = RemoteCallable<Input, Output> & RemoteActionBrand<Method>

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

/** Config for JSON body actions (POST, PUT, PATCH, DELETE). */
export type RemoteJsonActionConfig<Input = unknown> = {
  schema?: Schema<Input>
} & RemoteActionMeta

/** Config for `action.post({ type: "form" }, …)` handlers. */
export type RemoteFormActionConfig<Input = unknown> = {
  type: "form"
  schema?: Schema<Input>
} & RemoteActionMeta

export type RemoteActionFunction<Input, Output> =
  | RemoteGetAction<Output>
  | RemoteBodyAction<"POST", Input, Output>
  | RemoteBodyAction<"PUT", Input, Output>
  | RemoteBodyAction<"PATCH", Input, Output>
  | RemoteBodyAction<"DELETE", Input, Output>

export function isRemoteGetAction(value: unknown): value is RemoteGetAction<unknown> {
  return (
    !!value &&
    typeof value === "function" &&
    "__kiruRemoteAction" in value &&
    (value as RemoteGetAction<unknown>).__kiruRemoteMethod === "GET"
  )
}

export function isRemoteBodyAction(
  value: unknown
): value is RemoteBodyAction<"POST", unknown, unknown> {
  return (
    !!value &&
    typeof value === "function" &&
    "__kiruRemoteAction" in value &&
    isRemoteActionBodyMethod(
      (value as RemoteBodyAction<"POST", unknown, unknown>).__kiruRemoteMethod
    )
  )
}

function createRemoteAction<Input, Output, Method extends RemoteActionMethod>(
  method: Method,
  runAction: RemoteActionHandler<Input, Output>,
  validateActionInput: (input: unknown) => void | Promise<void>,
  meta?: RemoteActionMeta
): Method extends "GET"
  ? RemoteGetAction<Output>
  : RemoteBodyAction<Extract<Method, "POST" | "PUT" | "PATCH" | "DELETE">, Input, Output> {
  const invoke = async (args: RemoteActionHandlerArgs<Input>) => {
    await validateActionInput(args.input)
    return runAction(args)
  }

  if (method === "GET") {
    const wrapped = (async (
      options?: RemoteActionCallOptions<void>
    ): Promise<Output> => {
      const call = options ?? {}
      const args = resolveCallableHandlerArgs(undefined as void, call)
      await awaitActionValidation(validateActionInput, undefined)
      return dispatchCallableInvoke(
        runAction as RemoteActionHandler<void, Output>,
        args,
        wrapped.__kiruActionId
      )
    }) as RemoteGetAction<Output>

    wrapped.__kiruRemoteAction = true
    wrapped.__kiruRemoteMethod = "GET"
    wrapped.__kiruInvoke = invoke as RemoteActionBrand<"GET">["__kiruInvoke"]
    return wrapped as Method extends "GET"
      ? RemoteGetAction<Output>
      : RemoteBodyAction<
          Extract<Method, "POST" | "PUT" | "PATCH" | "DELETE">,
          Input,
          Output
        >
  }

  const wrapped = (async (
    options?: RemoteActionCallOptions<Input>
  ): Promise<Output> => {
    const call = (options ?? {}) as RemoteActionCallOptions<Input>
    const input = (
      "input" in (call as object) ? (call as { input: Input }).input : undefined
    ) as Input
    const args = resolveCallableHandlerArgs(input, call)
    await awaitActionValidation(validateActionInput, args.input)
    return dispatchCallableInvoke(runAction, args, wrapped.__kiruActionId)
  }) as RemoteBodyAction<
    Extract<Method, "POST" | "PUT" | "PATCH" | "DELETE">,
    Input,
    Output
  >

  wrapped.__kiruRemoteAction = true
  wrapped.__kiruRemoteMethod = method as Extract<
    Method,
    "POST" | "PUT" | "PATCH" | "DELETE"
  >
  if (meta?.invalidate?.length) {
    wrapped.__kiruInvalidateRoutes = meta.invalidate
  }
  if (meta?.revalidate) {
    wrapped.__kiruRevalidate = meta.revalidate
  }
  wrapped.__kiruInvoke = invoke as RemoteActionBrand<
    Extract<Method, "POST" | "PUT" | "PATCH" | "DELETE">
  >["__kiruInvoke"]
  return wrapped as Method extends "GET"
    ? RemoteGetAction<Output>
    : RemoteBodyAction<
        Extract<Method, "POST" | "PUT" | "PATCH" | "DELETE">,
        Input,
        Output
      >
}

function metaFromConfig(config: RemoteJsonActionConfig<unknown>): RemoteActionMeta {
  return {
    invalidate: config.invalidate,
    revalidate: config.revalidate,
  }
}

function createJsonBodyAction<
  Method extends "POST" | "PUT" | "PATCH" | "DELETE",
  Input,
  Output,
>(
  method: Method,
  runAction: RemoteActionHandler<Input, Output>,
  schema?: Schema<Input>,
  meta?: RemoteActionMeta
): RemoteBodyAction<Method, Input, Output> {
  const validateActionInput = (input: unknown): void | Promise<void> => {
    if (!schema) return
    return (async () => {
      try {
        await parseInput(schema, input)
      } catch {
        throw new RemoteError("Invalid remote action input", "INVALID_INPUT", {
          status: 400,
        })
      }
    })()
  }
  return createRemoteAction(
    method,
    runAction,
    validateActionInput,
    meta
  ) as RemoteBodyAction<Method, Input, Output>
}

function handlerArgsFromFormInvoke(
  args: RemoteFormActionHandlerArgs
): RemoteActionHandlerArgs<void> {
  return {
    input: undefined,
    context: args.context,
    signal: args.signal,
    execution: args.execution,
  }
}

function createFormPostAction<Input, Output>(
  config: RemoteFormActionConfig<Input>,
  callback:
    | RemoteFormActionHandler<Output>
    | RemoteActionHandler<Input, Output>
): RemoteFormActionFunction<Output> {
  const meta = metaFromConfig(config)
  const schema = config.schema

  const __kiruInvoke = schema
    ? async (args: RemoteFormActionHandlerArgs) => {
        const raw = formDataToInput(args.formData)
        let input: Input
        try {
          input = await parseInput(schema, raw)
        } catch {
          throw new RemoteError("Invalid remote action input", "INVALID_INPUT", {
            status: 400,
          })
        }
        return Promise.resolve(
          (callback as RemoteActionHandler<Input, Output>)({
            ...handlerArgsFromFormInvoke(args),
            input,
          })
        )
      }
    : (args: RemoteFormActionHandlerArgs) =>
        Promise.resolve(
          (callback as RemoteFormActionHandler<Output>)(args)
        )

  return {
    __kiruFormAction: true,
    __kiruFormActionId: "",
    __kiruInvalidateRoutes: meta.invalidate,
    __kiruRevalidate: meta.revalidate,
    __kiruInvoke,
  }
}

type JsonBodyMethod = "POST" | "PUT" | "PATCH" | "DELETE"

function defineJsonBodyAction<Method extends JsonBodyMethod>(method: Method) {
  function bodyAction<Input, Output>(
    callback: RemoteActionHandler<Input, Output>
  ): RemoteBodyAction<Method, Input, Output>
  function bodyAction<Output>(
    config: { type: "form"; schema?: undefined } & RemoteActionMeta,
    callback: RemoteFormActionHandler<Output>
  ): RemoteFormActionFunction<Output>
  function bodyAction<Input, Output>(
    config: { type: "form"; schema: Schema<Input> } & RemoteActionMeta,
    callback: RemoteActionHandler<Input, Output>
  ): RemoteFormActionFunction<Output>
  function bodyAction<Input, Output>(
    config: RemoteJsonActionConfig<Input>,
    callback: RemoteActionHandler<Input, Output>
  ): RemoteBodyAction<Method, Input, Output>
  function bodyAction<Input, Output>(
    callbackOrConfig:
      | RemoteActionHandler<Input, Output>
      | RemoteJsonActionConfig<Input>
      | RemoteFormActionConfig<Input>,
    maybeCallback?:
      | RemoteFormActionHandler<Output>
      | RemoteActionHandler<Input, Output>
  ):
    | RemoteBodyAction<Method, Input, Output>
    | RemoteFormActionFunction<Output> {
    if (typeof callbackOrConfig === "function") {
      return createJsonBodyAction(method, callbackOrConfig)
    }
    const config = callbackOrConfig
    const callback = maybeCallback
    if (!callback) {
      throw new Error(`action.${method.toLowerCase()}(config, callback) requires a handler`)
    }
    if ("type" in config && config.type === "form") {
      if (method !== "POST") {
        throw new Error(`action.${method.toLowerCase()} does not support form actions`)
      }
      return createFormPostAction(config, callback)
    }
    return createJsonBodyAction(
      method,
      callback as RemoteActionHandler<Input, Output>,
      config.schema,
      metaFromConfig(config)
    )
  }
  return bodyAction
}

export const action = {
  get<Output>(
    callback: RemoteActionHandler<void, Output>
  ): RemoteGetAction<Output> {
    return createRemoteAction("GET", callback, () => {}) as RemoteGetAction<Output>
  },
  post: defineJsonBodyAction("POST"),
  put: defineJsonBodyAction("PUT"),
  patch: defineJsonBodyAction("PATCH"),
  delete: defineJsonBodyAction("DELETE"),
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

export function isRemoteFormAction(
  value: unknown
): value is RemoteFormActionFunction<unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruFormAction" in value &&
    (value as { __kiruFormAction: unknown }).__kiruFormAction === true
  )
}

export type RemoteFormActionHandlerArgs = {
  formData: FormData
  context: CustomRequestContext
  signal: AbortSignal
  execution?: ActionExecution
}

export type RemoteFormActionHandler<Output> = (
  args: RemoteFormActionHandlerArgs
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
  __kiruInvoke: (args: RemoteFormActionHandlerArgs) => Promise<Output>
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
