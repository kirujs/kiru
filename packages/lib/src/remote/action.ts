import type { CustomRequestContext } from "../router/types.js"
import { serializeValidatedQuery } from "../router/searchParams.js"
import type { InferSchemaOutput, Schema } from "../validation/index.js"
import { parseInput } from "../validation/index.js"
import {
  runActionMiddleware,
  type ActionMiddleware,
  type RemoteActionMethod,
} from "./actionMiddleware.js"
import { fail, type KiruActionFail } from "./actionFail.js"
import { RemoteError } from "./errors.js"
import {
  getActionExecutionContext,
  getActiveActionContext,
  runWithActionFrame,
  toRemoteActionHandlerArgs,
} from "./actionInvokeScope.js"
import {
  getSsrActionScopeEntry,
  runWithSsrActionContext,
} from "./ssrActionScope.js"

export type {
  ActionSchema,
  InferSchemaOutput,
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

export type { ActionMiddleware, ActionMiddlewareContext } from "./actionMiddleware.js"
export { runActionMiddleware } from "./actionMiddleware.js"

// ---------------------------------------------------------------------------
// SSR request-context threading
// ---------------------------------------------------------------------------

import type { ActionExecution } from "./actionExecution.js"
import { headersToValidationInput } from "./actionExecution.js"

export type {
  ActionExecution,
  ActionExecutionFrame,
  RequestEnvelope,
  RuntimeContext,
  ExecutionState,
  MiddlewareState,
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
  headersToValidationInput,
  listActionFrames,
} from "./actionExecution.js"
export { getActionExecutionContext } from "./actionInvokeScope.js"

export type { RemoteActionMethod }

/** Flat input for handlers and middleware (not the ALS object). */
export type RemoteActionInput<Body = unknown, Query = void> = {
  body: Body
  query: Query
  headers: Record<string, string>
  context: CustomRequestContext
  signal: AbortSignal
}

/** Arguments passed to remote action handlers. */
export type RemoteActionHandlerArgs<
  Body,
  Query = void,
> = RemoteActionInput<Body, Query>

/** Registry / HTTP entry invoke shape (unknown at the boundary). */
export type RemoteActionInvokeArgs = {
  body: unknown
  query: Record<string, string | string[]>
  context: CustomRequestContext
  signal: AbortSignal
  request: Request
  execution?: ActionExecution
}

export function buildRemoteActionHandlerArgs<Body, Query = void>(
  context: CustomRequestContext,
  signal: AbortSignal,
  body: Body,
  query: Query,
  headers: Record<string, string> = {}
): RemoteActionHandlerArgs<Body, Query> {
  return { body, query, headers, context, signal }
}

/** Parse URL search params for an action RPC (excludes `action`). */
export function parseActionQueryFromUrl(
  url: URL
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "action") continue
    const existing = out[key]
    if (existing === undefined) {
      out[key] = value
    } else if (Array.isArray(existing)) {
      existing.push(value)
    } else {
      out[key] = [existing, value]
    }
  }
  return out
}

/** Serialize client `query` for appending to `/?action=…` (no leading `?`). */
export function serializeActionCallQuery(
  query: Record<string, unknown>
): string {
  return serializeValidatedQuery(query)
}

/** Active SSR handler args while inside a sync `runWithSsrRequestContext` scope. */
export function __getSsrActionContext(): RemoteActionHandlerArgs<void, void> {
  const entry = getSsrActionScopeEntry()
  if (!entry) {
    return buildRemoteActionHandlerArgs(
      {},
      new AbortController().signal,
      undefined,
      undefined,
      {}
    )
  }
  return buildRemoteActionHandlerArgs(
    entry.context,
    entry.signal,
    undefined,
    undefined,
    {}
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

export type RemoteActionCallOptions<Body = void, Query = void> = {
  signal?: AbortSignal
  body?: Body
  query?: Query
}

function resolveCallableHandlerArgs<Body, Query>(
  body: Body,
  query: Query,
  call?: RemoteActionCallOptions<Body, Query>
): Pick<
  RemoteActionHandlerArgs<Body, Query>,
  "body" | "query" | "headers" | "context" | "signal"
> {
  const active = getActiveActionContext()
  if (active) {
    const signal = call?.signal ?? active.signal
    return {
      body,
      query,
      headers: active.headers,
      context: active.context,
      signal,
    }
  }
  const ssr = getSsrActionScopeEntry()
  if (ssr) {
    const signal = call?.signal ?? ssr.signal
    return buildRemoteActionHandlerArgs(ssr.context, signal, body, query, {})
  }
  throw new Error(
    "Remote action called without request context. Use during SSR render, inside another action handler, or from the client (after hydration)."
  )
}

type ActionValidation<Body, Query> = {
  bodySchema?: Schema<Body>
  querySchema?: Schema<Query>
}

async function validateActionPayload<Body, Query>(
  validation: ActionValidation<Body, Query>,
  raw: { body: unknown; query: unknown }
): Promise<{ body: Body; query: Query }> {
  let body = raw.body as Body
  let query = raw.query as Query

  if (validation.bodySchema) {
    try {
      body = await parseInput(validation.bodySchema, raw.body)
    } catch {
      throw new RemoteError("Invalid remote action body", "INVALID_BODY", {
        status: 400,
      })
    }
  }

  if (validation.querySchema) {
    try {
      query = await parseInput(validation.querySchema, raw.query)
    } catch {
      throw new RemoteError("Invalid remote action query", "INVALID_QUERY", {
        status: 400,
      })
    }
  }

  return { body, query }
}

function dispatchCallableInvoke<Body, Query, Output>(
  runHandler: RemoteActionHandler<Body, Query, Output>,
  args: RemoteActionHandlerArgs<Body, Query>,
  actionId?: string
): Promise<KiruActionServerResult<Output>> {
  const execution = getActionExecutionContext()
  if (execution && actionId) {
    return Promise.resolve(
      runWithActionFrame(actionId, () =>
        runHandler(
          toRemoteActionHandlerArgs(
            execution,
            args.body,
            args.query,
            args.headers
          )
        )
      )
    )
  }
  return Promise.resolve(runHandler(args))
}

// ---------------------------------------------------------------------------
// Remote action (JSON)
// ---------------------------------------------------------------------------

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

export type RemoteActionHandler<Body, Query, Output> = (
  args: RemoteActionHandlerArgs<Body, Query>
) =>
  | Promise<KiruActionServerResult<Output>>
  | KiruActionServerResult<Output>

type RemoteCallable<Body, Query, Output> = (
  options?: RemoteActionCallOptions<Body, Query>
) => Promise<Output>

type RemoteActionBrand<Method extends RemoteActionMethod> = {
  __kiruRemoteAction: true
  __kiruRemoteMethod: Method
  /** RPC id (`routeId:export.path`) for frame stack / tracing. */
  __kiruActionId?: string
  __kiruInvoke: (args: RemoteActionInvokeArgs) => Promise<unknown>
  __kiruInvalidateRoutes?: string[]
  __kiruRevalidate?: RemoteRevalidateMeta
}

export type RemoteGetAction<Query = void, Output = unknown> = RemoteCallable<
  void,
  Query,
  Output
> &
  RemoteActionBrand<"GET">

export type RemoteBodyAction<
  Method extends "POST" | "PUT" | "PATCH" | "DELETE",
  Body,
  Query,
  Output,
> = RemoteCallable<Body, Query, Output> & RemoteActionBrand<Method>

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

export type RemoteActionValidationConfig<Body = unknown, Query = unknown> = {
  body?: Schema<Body>
  query?: Schema<Query>
}

export type RemoteJsonActionConfig<
  Body = unknown,
  Query = void,
  Output = unknown,
> = {
  validation?: RemoteActionValidationConfig<Body, Query>
  middleware?: ActionMiddleware[]
  handler: RemoteActionHandler<Body, Query, Output>
} & RemoteActionMeta

export type RemoteGetActionConfig<
  Query = void,
  Output = unknown,
> = {
  validation?: Pick<RemoteActionValidationConfig<void, Query>, "query">
  middleware?: ActionMiddleware[]
  handler: RemoteActionHandler<void, Query, Output>
} & RemoteActionMeta

/** Infer validated body type from an action config object's `validation.body` schema. */
export type InferActionConfigBody<T> = T extends {
  validation?: { body?: Schema<infer B> }
}
  ? B
  : T extends { validation?: { body?: infer S } }
    ? InferSchemaOutput<S>
    : unknown

/** Infer validated query type from an action config object's `validation.query` schema. */
export type InferActionConfigQuery<T> = T extends {
  validation?: { query?: Schema<infer Q> }
}
  ? Q
  : T extends { validation?: { query?: infer S } }
    ? InferSchemaOutput<S>
    : void

/** Infer handler return type from an action config object's `handler`. */
export type InferActionConfigOutput<T> = T extends {
  handler: (...args: never[]) => infer R
}
  ? Awaited<R>
  : unknown

/** Config for `action.post({ type: "form" }, …)` handlers. */
export type RemoteFormActionConfig<Input = unknown> = {
  type: "form"
  schema?: Schema<Input>
} & RemoteActionMeta

export type RemoteActionFunction<Body, Query, Output> =
  | RemoteGetAction<Query, Output>
  | RemoteBodyAction<"POST", Body, Query, Output>
  | RemoteBodyAction<"PUT", Body, Query, Output>
  | RemoteBodyAction<"PATCH", Body, Query, Output>
  | RemoteBodyAction<"DELETE", Body, Query, Output>

export function isRemoteGetAction(
  value: unknown
): value is RemoteGetAction<unknown, unknown> {
  return (
    !!value &&
    typeof value === "function" &&
    "__kiruRemoteAction" in value &&
    (value as RemoteGetAction<unknown, unknown>).__kiruRemoteMethod === "GET"
  )
}

export function isRemoteBodyAction(
  value: unknown
): value is RemoteBodyAction<"POST", unknown, unknown, unknown> {
  return (
    !!value &&
    typeof value === "function" &&
    "__kiruRemoteAction" in value &&
    isRemoteActionBodyMethod(
      (value as RemoteBodyAction<"POST", unknown, unknown, unknown>)
        .__kiruRemoteMethod
    )
  )
}

function metaFromJsonConfig(config: {
  invalidate?: string[]
  revalidate?: RemoteRevalidateMeta
}): RemoteActionMeta {
  return {
    invalidate: config.invalidate,
    revalidate: config.revalidate,
  }
}

function metaFromFormConfig(config: RemoteFormActionConfig<unknown>): RemoteActionMeta {
  return {
    invalidate: config.invalidate,
    revalidate: config.revalidate,
  }
}

function isConfiguredJsonActionConfig(
  value: unknown
): value is RemoteJsonActionConfig<unknown, void, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    "handler" in value &&
    typeof (value as RemoteJsonActionConfig).handler === "function"
  )
}

function isConfiguredGetActionConfig(
  value: unknown
): value is RemoteGetActionConfig<unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    "handler" in value &&
    typeof (value as RemoteGetActionConfig).handler === "function"
  )
}

type CreateActionOptions<Body, Query, Output> = {
  handler: RemoteActionHandler<Body, Query, Output>
  validation?: ActionValidation<Body, Query>
  middleware?: ActionMiddleware[]
  meta?: RemoteActionMeta
}

function createRemoteAction<Body, Query, Output, Method extends RemoteActionMethod>(
  method: Method,
  options: CreateActionOptions<Body, Query, Output>
): Method extends "GET"
  ? RemoteGetAction<Query, Output>
  : RemoteBodyAction<
      Extract<Method, "POST" | "PUT" | "PATCH" | "DELETE">,
      Body,
      Query,
      Output
    > {
  const {
    handler: runAction,
    validation = {},
    middleware = [],
    meta,
  } = options

  const invoke = async (args: RemoteActionInvokeArgs) => {
    const headers = headersToValidationInput(
      args.execution?.request.headers ?? args.request.headers
    )
    await runActionMiddleware(middleware, {
      body: args.body,
      query: args.query,
      headers,
      context: args.context,
      signal: args.signal,
    })
    const validated = await validateActionPayload(validation, {
      body: args.body,
      query: args.query,
    })
    return runAction({
      body: validated.body,
      query: validated.query,
      headers,
      context: args.context,
      signal: args.signal,
    })
  }

  if (method === "GET") {
    const wrapped = (async (
      options?: RemoteActionCallOptions<void, Query>
    ): Promise<Output> => {
      const call = options ?? {}
      const query = (
        "query" in (call as object)
          ? (call as { query: Query }).query
          : (undefined as Query)
      ) as Query
      const args = resolveCallableHandlerArgs(undefined as void, query, call)
      const validated = await validateActionPayload(validation, {
        body: undefined,
        query: args.query,
      })
      return dispatchCallableInvoke(
        runAction,
        {
          ...args,
          body: validated.body,
          query: validated.query,
        },
        wrapped.__kiruActionId
      ) as Promise<Output>
    }) as RemoteGetAction<Query, Output>

    wrapped.__kiruRemoteAction = true
    wrapped.__kiruRemoteMethod = "GET"
    wrapped.__kiruInvoke = invoke as RemoteActionBrand<"GET">["__kiruInvoke"]
    return wrapped as Method extends "GET"
      ? RemoteGetAction<Query, Output>
      : RemoteBodyAction<
          Extract<Method, "POST" | "PUT" | "PATCH" | "DELETE">,
          Body,
          Query,
          Output
        >
  }

  const wrapped = (async (
    options?: RemoteActionCallOptions<Body, Query>
  ): Promise<Output> => {
    const call = (options ?? {}) as RemoteActionCallOptions<Body, Query>
    const body = (
      "body" in (call as object)
        ? (call as { body: Body }).body
        : (undefined as Body)
    ) as Body
    const query = (
      "query" in (call as object)
        ? (call as { query: Query }).query
        : (undefined as Query)
    ) as Query
    const args = resolveCallableHandlerArgs(body, query, call)
    const validated = await validateActionPayload(validation, {
      body: args.body,
      query: args.query,
    })
    return dispatchCallableInvoke(
      runAction,
      {
        ...args,
        body: validated.body,
        query: validated.query,
      },
      wrapped.__kiruActionId
    ) as Promise<Output>
  }) as RemoteBodyAction<
    Extract<Method, "POST" | "PUT" | "PATCH" | "DELETE">,
    Body,
    Query,
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
    ? RemoteGetAction<Query, Output>
    : RemoteBodyAction<
        Extract<Method, "POST" | "PUT" | "PATCH" | "DELETE">,
        Body,
        Query,
        Output
      >
}

function createJsonBodyAction<
  Method extends "POST" | "PUT" | "PATCH" | "DELETE",
  Body,
  Query,
  Output,
>(
  method: Method,
  config: CreateActionOptions<Body, Query, Output>
): RemoteBodyAction<Method, Body, Query, Output> {
  return createRemoteAction(method, config) as RemoteBodyAction<
    Method,
    Body,
    Query,
    Output
  >
}

function handlerArgsFromFormInvoke(
  args: RemoteFormActionHandlerArgs
): RemoteActionHandlerArgs<void, void> {
  return {
    body: undefined,
    query: undefined as void,
    headers: args.headers,
    context: args.context,
    signal: args.signal,
  }
}

function createFormPostAction<Input, Output>(
  config: RemoteFormActionConfig<Input>,
  callback:
    | RemoteFormActionHandler<Output>
    | RemoteActionHandler<Input, void, Output>
): RemoteFormActionFunction<Output> {
  const meta = metaFromFormConfig(config)
  const schema = config.schema

  const __kiruInvoke = schema
    ? async (args: RemoteFormActionHandlerArgs) => {
        const raw = formDataToInput(args.formData)
        let body: Input
        try {
          body = await parseInput(schema, raw)
        } catch {
          return fail({
            message: "Invalid input",
            status: 422,
            code: "INVALID_BODY",
            fields: { _form: "Invalid input" },
          })
        }
        return Promise.resolve(
          (callback as RemoteActionHandler<Input, void, Output>)({
            ...handlerArgsFromFormInvoke(args),
            body,
            query: undefined as void,
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
  function bodyAction<Body, Query, Output>(
    callback: RemoteActionHandler<Body, Query, Output>
  ): RemoteBodyAction<Method, Body, Query, Output>
  function bodyAction<Output>(
    config: { type: "form"; schema?: undefined } & RemoteActionMeta,
    callback: RemoteFormActionHandler<Output>
  ): RemoteFormActionFunction<Output>
  function bodyAction<Input, Output>(
    config: { type: "form"; schema: Schema<Input> } & RemoteActionMeta,
    callback: RemoteActionHandler<Input, void, Output>
  ): RemoteFormActionFunction<Output>
  function bodyAction<
    Config extends {
      validation?: RemoteActionValidationConfig
      middleware?: ActionMiddleware[]
      handler: RemoteActionHandler<any, any, any>
    } & RemoteActionMeta,
  >(
    config: Config
  ): RemoteBodyAction<
    Method,
    InferActionConfigBody<Config>,
    InferActionConfigQuery<Config>,
    InferActionConfigOutput<Config>
  >
  function bodyAction<Body, Query, Output>(
    callbackOrConfig:
      | RemoteActionHandler<Body, Query, Output>
      | RemoteJsonActionConfig<Body, Query, Output>
      | RemoteFormActionConfig<Body>,
    maybeCallback?:
      | RemoteFormActionHandler<Output>
      | RemoteActionHandler<Body, Query, Output>
  ): any {
    if (typeof callbackOrConfig === "function") {
      return createJsonBodyAction(method, { handler: callbackOrConfig })
    }
    const config = callbackOrConfig
    if ("type" in config && config.type === "form") {
      const callback = maybeCallback
      if (!callback) {
        throw new Error(
          `action.${method.toLowerCase()}({ type: "form" }, handler) requires a handler`
        )
      }
      if (method !== "POST") {
        throw new Error(`action.${method.toLowerCase()} does not support form actions`)
      }
      return createFormPostAction(
        config,
        callback as
          | RemoteFormActionHandler<Output>
          | RemoteActionHandler<Body, void, Output>
      )
    }
    if (!isConfiguredJsonActionConfig(config)) {
      throw new Error(
        `action.${method.toLowerCase()}(config) requires a config object with a handler`
      )
    }
    return createJsonBodyAction(method, {
      handler: config.handler as RemoteActionHandler<
      InferActionConfigBody<typeof config>,
      InferActionConfigQuery<typeof config>,
      InferActionConfigOutput<typeof config>
    >,
      validation: {
        bodySchema: config.validation?.body as
          | Schema<InferActionConfigBody<typeof config>>
          | undefined,
        querySchema: config.validation?.query as
          | Schema<InferActionConfigQuery<typeof config>>
          | undefined,
      },
      middleware: config.middleware,
      meta: metaFromJsonConfig(config),
    }) as RemoteBodyAction<
      Method,
      InferActionConfigBody<typeof config>,
      InferActionConfigQuery<typeof config>,
      InferActionConfigOutput<typeof config>
    >
  }
  return bodyAction
}

function getAction<Query, Output>(
  callback: RemoteActionHandler<void, Query, Output>
): RemoteGetAction<Query, Output>
function getAction<
  Config extends {
    validation?: Pick<RemoteActionValidationConfig, "query">
    middleware?: ActionMiddleware[]
    handler: RemoteActionHandler<void, any, any>
  } & RemoteActionMeta,
>(
  config: Config
): RemoteGetAction<
  InferActionConfigQuery<Config>,
  InferActionConfigOutput<Config>
>
function getAction<Query, Output>(
  callbackOrConfig:
    | RemoteActionHandler<void, Query, Output>
    | RemoteGetActionConfig<Query, Output>
): any {
  if (typeof callbackOrConfig === "function") {
    return createRemoteAction("GET", { handler: callbackOrConfig })
  }
  if (!isConfiguredGetActionConfig(callbackOrConfig)) {
    throw new Error("action.get(config) requires a config object with a handler")
  }
  const config = callbackOrConfig
  return createRemoteAction("GET", {
    handler: config.handler as RemoteActionHandler<
      void,
      InferActionConfigQuery<typeof config>,
      InferActionConfigOutput<typeof config>
    >,
    validation: {
      querySchema: config.validation?.query as
        | Schema<InferActionConfigQuery<typeof config>>
        | undefined,
    },
    middleware: config.middleware,
    meta: metaFromJsonConfig(config),
  }) as RemoteGetAction<
    InferActionConfigQuery<typeof config>,
    InferActionConfigOutput<typeof config>
  >
}

export const action = {
  get: getAction,
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

/** Structured Set-Cookie for action response metadata (serialized by the framework). */
export type KiruSetCookie = {
  name: string
  value: string
  path?: string
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "Strict" | "Lax" | "None"
}

/** Optional cookies and signed context refresh on action responses. */
export type KiruActionResponseOptions = {
  cookies?: readonly KiruSetCookie[]
  /** When set, the framework signs this context into `x-kiru-token` on the HTTP response. */
  context?: CustomRequestContext
}

/** Returned by {@link redirect} inside an action callback to trigger a server-side redirect. */
export type KiruRedirect = {
  readonly __kiruRedirect: true
  readonly status: number
  readonly location: string
  readonly cookies?: readonly KiruSetCookie[]
  readonly context?: CustomRequestContext
}

/** Wrapper for action success with response metadata (cookies, token refresh). */
export type KiruActionResult<T> = {
  readonly __kiruActionResult: true
  readonly value: T
  readonly cookies?: readonly KiruSetCookie[]
  readonly context?: CustomRequestContext
}

/** Create a redirect response from inside an action callback. */
export function redirect(
  status: number,
  location: string,
  options?: KiruActionResponseOptions
): KiruRedirect {
  return {
    __kiruRedirect: true,
    status,
    location,
    cookies: options?.cookies,
    context: options?.context,
  }
}

/** Attach Set-Cookie / context refresh metadata to a non-redirect action result. */
export function actionResult<T>(
  value: T,
  options?: KiruActionResponseOptions
): KiruActionResult<T> {
  return {
    __kiruActionResult: true,
    value,
    cookies: options?.cookies,
    context: options?.context,
  }
}

export function isKiruRedirect(value: unknown): value is KiruRedirect {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruRedirect" in value &&
    (value as { __kiruRedirect: unknown }).__kiruRedirect === true
  )
}

export function isKiruActionResult(value: unknown): value is KiruActionResult<unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruActionResult" in value &&
    (value as { __kiruActionResult: unknown }).__kiruActionResult === true
  )
}

export type {
  KiruActionFail,
  KiruActionFailWire,
} from "./actionFail.js"
export {
  fail,
  isKiruActionFail,
  failWireBody,
  resolveFailHttpStatus,
  sanitizeFailFields,
} from "./actionFail.js"

export { ActionFailure, isActionFailure } from "./actionFailure.js"

/** Server handler return before HTTP serialization (success + transport markers). */
export type KiruActionServerResult<Output> =
  | Output
  | KiruRedirect
  | KiruActionFail
  | KiruActionResult<Output>

/** Unwrap transport wrappers for client-visible action output types. */
export type UnwrapKiruActionOutput<T> = T extends KiruActionResult<infer V>
  ? V
  : T extends KiruRedirect | KiruActionFail
    ? never
    : T

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
  headers: Record<string, string>
  context: CustomRequestContext
  signal: AbortSignal
}

export type RemoteFormActionHandler<Output> = (
  args: RemoteFormActionHandlerArgs
) =>
  | Promise<KiruActionServerResult<Output>>
  | KiruActionServerResult<Output>

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
    args: RemoteFormActionHandlerArgs
  ) => Promise<KiruActionServerResult<Output>>
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
