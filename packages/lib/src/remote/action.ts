import type { CustomRequestContext } from "../router/types.js"
import { serializeValidatedQuery } from "../router/searchParams.js"
import type { InferSchemaOutput, Schema } from "../validation/index.js"
import { parseInput } from "../validation/index.js"
import {
  runActionMiddleware,
  type ActionMiddleware,
  type RemoteActionMethod,
} from "./actionMiddleware.js"
import { ActionCookies } from "./actionCookies.js"
import {
  runWithActionResponseScope,
  requestHeadersRecord,
  type HandlerWithScopeResult,
} from "./actionResponseScope.js"
import { RemoteError } from "./errors.js"
import {
  getActionExecutionContext,
  getActiveActionContext,
  runWithActionFrame,
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

export type ActionRequest<Body = unknown, Query = void> = {
  body: Body
  query: Query
  /** Incoming request headers (lowercase keys; first value wins). */
  headers: Record<string, string>
}

export type ActionResponse = {
  /** Outgoing response headers for this action. */
  headers: Headers
  cookies: ActionCookies
}

/** Arguments passed to remote action handlers. */
export type RemoteActionHandlerArgs<
  Body,
  Query = void,
> = {
  request: ActionRequest<Body, Query>
  response: ActionResponse
  context: CustomRequestContext
  signal: AbortSignal
}

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
  query: Query
): RemoteActionHandlerArgs<Body, Query> {
  return {
    request: {
      body,
      query,
      headers: {},
    },
    response: {
      headers: new Headers(),
      cookies: new ActionCookies(),
    },
    context,
    signal,
  }
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
      undefined
    )
  }
  return buildRemoteActionHandlerArgs(
    entry.context,
    entry.signal,
    undefined,
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

export type RemoteActionCallOptions<Body = void, Query = void> = {
  signal?: AbortSignal
  body?: Body
  query?: Query
  headers?: Record<string, string>
}

function resolveCallableHandlerArgs<Body, Query>(
  body: Body,
  query: Query,
  call?: RemoteActionCallOptions<Body, Query>
): Pick<
  RemoteActionHandlerArgs<Body, Query>,
  "request" | "response" | "context" | "signal"
> {
  const active = getActiveActionContext()
  if (active) {
    const signal = call?.signal ?? active.signal
    return {
      request: {
        body,
        query,
        headers: active.request.headers,
      },
      response: active.response,
      context: active.context,
      signal,
    }
  }
  const ssr = getSsrActionScopeEntry()
  if (ssr) {
    const signal = call?.signal ?? ssr.signal
    return buildRemoteActionHandlerArgs(ssr.context, signal, body, query)
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

async function dispatchCallableInvoke<Body, Query, Output>(
  runHandler: RemoteActionHandler<Body, Query, Output>,
  args: RemoteActionHandlerArgs<Body, Query>,
  actionId?: string
): Promise<Output> {
  const execution = getActionExecutionContext()
  if (execution && actionId) {
    return runWithActionFrame(actionId, async () => {
      const { handlerResult } = await runWithActionResponseScope(
        execution,
        (scope) =>
          runHandler(scope.toHandlerArgs(args.request.body, args.request.query))
      )
      return handlerResult as Output
    })
  }
  return (await runHandler(args)) as Output
}

// ---------------------------------------------------------------------------
// Remote action (JSON RPC — always POST on the wire)
// ---------------------------------------------------------------------------

export type RemoteActionHandler<Body, Query, Output> = (
  args: RemoteActionHandlerArgs<Body, Query>
) =>
  | Promise<KiruActionServerResult<Output>>
  | KiruActionServerResult<Output>

type RemoteCallable<Body, Query, Output> = (
  options?: RemoteActionCallOptions<Body, Query>
) => Promise<Output>

type RemoteActionBrand = {
  __kiruRemoteAction: true
  /** RPC id (`routeId:export.path`) for frame stack / tracing. */
  __kiruActionId?: string
  __kiruInvoke: (args: RemoteActionInvokeArgs) => Promise<HandlerWithScopeResult>
  __kiruInvalidateRoutes?: string[]
  __kiruRevalidate?: RemoteRevalidateMeta
}

/** Typed JSON remote action callable (client stub + server handler). */
export type RemoteAction<Body = unknown, Query = void, Output = unknown> =
  RemoteCallable<Body, Query, Output> & RemoteActionBrand

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
  type?: never
  validation?: RemoteActionValidationConfig<Body, Query>
  middleware?: ActionMiddleware[]
  handler: RemoteActionHandler<Body, Query, Output>
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

/** Form handler when `validation.body` parses FormData into `body`. */
export type RemoteFormActionHandlerWithBody<Input, Output> = (
  args: Omit<RemoteFormActionHandlerArgs, "request"> & {
    request: Omit<RemoteFormActionHandlerArgs["request"], "body" | "query"> & {
      body: Input
      query: void
    }
  }
) =>
  | Promise<KiruActionServerResult<Output>>
  | KiruActionServerResult<Output>

/** Config for `action({ type: "form", handler, … })`. */
export type RemoteFormActionConfig<Output = unknown> = {
  type: "form"
  handler: RemoteFormActionHandler<Output>
} & RemoteActionMeta

export type RemoteFormActionConfigWithBody<Input, Output = unknown> = {
  type: "form"
  validation: Pick<RemoteActionValidationConfig<Input, void>, "body">
  handler: RemoteFormActionHandlerWithBody<Input, Output>
} & RemoteActionMeta

export type RemoteActionFunction<Body, Query, Output> =
  | RemoteAction<Body, Query, Output>
  | RemoteFormActionFunction<Output>

export function isRemoteJsonAction(
  value: unknown
): value is RemoteAction<unknown, unknown, unknown> {
  return (
    !!value &&
    typeof value === "function" &&
    "__kiruRemoteAction" in value &&
    (value as RemoteAction).__kiruRemoteAction === true
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

function metaFromFormConfig(
  config: Pick<
    RemoteFormActionConfig | RemoteFormActionConfigWithBody<unknown>,
    "invalidate" | "revalidate"
  >
): RemoteActionMeta {
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
    !("type" in value && (value as { type: unknown }).type === "form") &&
    "handler" in value &&
    typeof (value as RemoteJsonActionConfig).handler === "function"
  )
}

function isFormActionConfig(
  value: unknown
): value is RemoteFormActionConfig | RemoteFormActionConfigWithBody<unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    "type" in value &&
    (value as RemoteFormActionConfig).type === "form"
  )
}

type CreateActionOptions<Body, Query, Output> = {
  handler: RemoteActionHandler<Body, Query, Output>
  validation?: ActionValidation<Body, Query>
  middleware?: ActionMiddleware[]
  meta?: RemoteActionMeta
}

function createRemoteAction<Body, Query, Output>(
  options: CreateActionOptions<Body, Query, Output>
): RemoteAction<Body, Query, Output> {
  const {
    handler: runAction,
    validation = {},
    middleware = [],
    meta,
  } = options

  const invoke = async (args: RemoteActionInvokeArgs): Promise<HandlerWithScopeResult> => {
    const execution = args.execution ?? getActionExecutionContext()
    if (!execution) {
      throw new Error(
        "Remote action invoke requires ActionExecution (HTTP entry or runInActionExecution)"
      )
    }
    return runWithActionResponseScope(execution, async (scope) => {
      const reqHeaders = requestHeadersRecord(execution)
      await runActionMiddleware(middleware, {
        request: {
          body: args.body,
          query: args.query,
          headers: reqHeaders,
        },
        context: execution.request.context,
        signal: args.signal,
      })
      const validated = await validateActionPayload(validation, {
        body: args.body,
        query: args.query,
      })
      return runAction(scope.toHandlerArgs(validated.body, validated.query))
    })
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
      body: args.request.body,
      query: args.request.query,
    })
    return dispatchCallableInvoke(
      runAction,
      {
        ...args,
        request: {
          ...args.request,
          body: validated.body,
          query: validated.query,
        },
      },
      wrapped.__kiruActionId
    )
  }) as RemoteAction<Body, Query, Output>

  wrapped.__kiruRemoteAction = true
  if (meta?.invalidate?.length) {
    wrapped.__kiruInvalidateRoutes = meta.invalidate
  }
  if (meta?.revalidate) {
    wrapped.__kiruRevalidate = meta.revalidate
  }
  wrapped.__kiruInvoke = invoke
  return wrapped
}

/** Boundary args for HTTP form invoke (handler receives full {@link RemoteFormActionHandlerArgs}). */
export type RemoteFormActionInvokeArgs = {
  formData: FormData
  signal: AbortSignal
}

function createFormPostAction<Input, Output>(
  config: RemoteFormActionConfig<Output> | RemoteFormActionConfigWithBody<Input, Output>
): RemoteFormActionFunction<Output> {
  const meta = metaFromFormConfig(config)
  const bodySchema =
    "validation" in config ? config.validation?.body : undefined
  const runHandler = config.handler

  const __kiruInvoke = async (
    args: RemoteFormActionInvokeArgs
  ): Promise<HandlerWithScopeResult> => {
    const execution = getActionExecutionContext()
    if (!execution) {
      throw new Error(
        "Form action invoke requires ActionExecution (HTTP entry or runInActionExecution)"
      )
    }
    return runWithActionResponseScope(execution, async (scope) => {
      const scopedArgs = scope.toHandlerArgs(undefined as void, undefined as void)
      const handlerArgs: RemoteFormActionHandlerArgs = {
        request: {
          ...scopedArgs.request,
          formData: args.formData,
        },
        response: scopedArgs.response,
        context: scopedArgs.context,
        signal: scopedArgs.signal,
        redirect,
      }
      if (bodySchema) {
        const raw = formDataToInput(args.formData)
        let body: Input
        try {
          body = await parseInput(bodySchema, raw)
        } catch {
          return {
            ok: false as const,
            errors: { _form: "Invalid input" },
          }
        }
        const withBody = {
          ...handlerArgs,
          request: {
            ...handlerArgs.request,
            body,
            query: undefined as void,
          },
        } as Parameters<RemoteFormActionHandlerWithBody<Input, Output>>[0]
        return (runHandler as RemoteFormActionHandlerWithBody<Input, Output>)(withBody)
      }
      return (runHandler as RemoteFormActionHandler<Output>)(handlerArgs)
    })
  }

  return {
    __kiruFormAction: true,
    __kiruFormActionId: "",
    __kiruInvalidateRoutes: meta.invalidate,
    __kiruRevalidate: meta.revalidate,
    __kiruInvoke,
  }
}

function actionFromJsonConfig<Body, Query, Output>(
  config: RemoteJsonActionConfig<Body, Query, Output>
): RemoteAction<Body, Query, Output> {
  return createRemoteAction({
    handler: config.handler,
    validation: {
      bodySchema: config.validation?.body,
      querySchema: config.validation?.query,
    },
    middleware: config.middleware,
    meta: metaFromJsonConfig(config),
  })
}

function actionImpl<Body, Query, Output>(
  handler: RemoteActionHandler<Body, Query, Output>
): RemoteAction<Body, Query, Output>
function actionImpl<Input, Output>(
  config: RemoteFormActionConfigWithBody<Input, Output>
): RemoteFormActionFunction<Output>
function actionImpl<Output>(
  config: RemoteFormActionConfig<Output>
): RemoteFormActionFunction<Output>
function actionImpl<Body, Query = void, Output = unknown>(
  config: RemoteJsonActionConfig<Body, Query, Output>
): RemoteAction<Body, Query, Output>
function actionImpl(
  handlerOrConfig:
    | RemoteActionHandler<unknown, unknown, unknown>
    | RemoteJsonActionConfig<unknown, void, unknown>
    | RemoteFormActionConfig
    | RemoteFormActionConfigWithBody<unknown, unknown>
): unknown {
  if (typeof handlerOrConfig === "function") {
    return createRemoteAction({ handler: handlerOrConfig })
  }
  const config = handlerOrConfig
  if (isFormActionConfig(config)) {
    if (typeof config.handler !== "function") {
      throw new Error('action({ type: "form", … }) requires a handler')
    }
    return createFormPostAction(config)
  }
  if (!isConfiguredJsonActionConfig(config)) {
    throw new Error("action(config) requires a config object with a handler")
  }
  return actionFromJsonConfig(config)
}

export const action = actionImpl as typeof actionImpl

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

export function isKiruRedirect(value: unknown): value is KiruRedirect {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruRedirect" in value &&
    (value as { __kiruRedirect: unknown }).__kiruRedirect === true
  )
}

export { ActionCookies } from "./actionCookies.js"
export type { ActionCookieDefaults, ActionCookieSetOptions } from "./actionCookies.js"

/** Server handler return before HTTP serialization. */
export type KiruActionServerResult<Output> = Output | KiruRedirect

/** Client-visible success output from a form action (excludes redirect / fail). */
export type FormActionClientOutput<T> = T

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
  request: ActionRequest<void, void> & {
    formData: FormData
  }
  response: ActionResponse
  context: CustomRequestContext
  signal: AbortSignal
  redirect: (
    status: number,
    location: string,
    options?: KiruActionResponseOptions
  ) => KiruRedirect
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
  /** Phantom for {@link Output} inference in {@link createFormController}. */
  readonly __output?: Output
  __kiruFormActionId: string
  __kiruInvalidateRoutes?: string[]
  __kiruRevalidate?: RemoteRevalidateMeta
  __kiruInvoke: (
    args: RemoteFormActionInvokeArgs
  ) => Promise<HandlerWithScopeResult>
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
