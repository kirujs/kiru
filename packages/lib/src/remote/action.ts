import type { CustomRequestContext } from "../router/types.js"
import type { Schema } from "../validation/index.js"
import { parseInput } from "../validation/index.js"
import { RemoteError } from "./errors.js"

export type {
  ActionSchema,
  KiruSchemaInput,
  KiruValidator,
  KiruValidationResult,
  Schema,
  StandardJSONSchema,
  StandardJSONSchemaV1,
  StandardSchema,
  StandardSchemaV1,
  StandardSchemaWithJson,
} from "../validation/index.js"
export {
  assertValid,
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

/** Set by the renderer before synchronous SSR rendering so that actions
 *  invoked directly (e.g. via `resource(myAction)`) receive the real
 *  per-request context instead of `null`. */
let _currentSsrCtx: CustomRequestContext

export function __setSsrRequestContext(ctx: CustomRequestContext): void {
  _currentSsrCtx = ctx
}

/** Active SSR render context (see {@link __setSsrRequestContext}). */
export function __getSsrRequestContext(): CustomRequestContext | undefined {
  return _currentSsrCtx
}

// ---------------------------------------------------------------------------
// Remote action (JSON)
// ---------------------------------------------------------------------------

export type RemoteActionMethod = "GET" | "POST"

export type RemoteActionCallback<Input, Output> = (
  ctx: CustomRequestContext,
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
  __kiruInvoke: (ctx: CustomRequestContext, input: unknown) => Promise<Output>
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

export type RemotePostAction<Input, Output> = ((
  input: Input,
  options?: RemoteActionOptions
) => Promise<Output>) & {
  __kiruRemoteAction: true
  __kiruRemoteMethod: "POST"
  __kiruInvoke: (ctx: CustomRequestContext, input: unknown) => Promise<Output>
  __kiruInvalidateRoutes?: string[]
  __kiruRevalidate?: RemoteRevalidateMeta
}

export type RemoteActionFunction<Input, Output> =
  | RemoteGetAction<Output>
  | RemotePostAction<Input, Output>

type GetCallback<Output> =
  | ((ctx: CustomRequestContext) => Promise<Output> | Output)
  | (() => Promise<Output> | Output)

function wrapGetCallback<Output>(
  callback: GetCallback<Output>
): (ctx: CustomRequestContext) => Promise<Output> | Output {
  if (callback.length === 0) {
    return () => (callback as () => Promise<Output> | Output)()
  }
  return callback as (ctx: CustomRequestContext) => Promise<Output> | Output
}

function createRemoteAction<Input, Output>(
  method: RemoteActionMethod,
  runAction: RemoteActionCallback<Input, Output>,
  validateActionInput: (input: unknown) => void | Promise<void>,
  meta?: RemoteActionMeta
): RemoteGetAction<Output> | RemotePostAction<Input, Output> {
  if (method === "GET") {
    const wrapped = (async (_options?: RemoteActionOptions): Promise<Output> => {
      await validateActionInput(undefined)
      return runAction(_currentSsrCtx, undefined as Input)
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
    await validateActionInput(input)
    return runAction(_currentSsrCtx, input)
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

function createPostAction<Input, Output>(
  callbackOrValidator: Schema<Input> | RemoteActionCallback<Input, Output>,
  callbackOrMeta?:
    | RemoteActionCallback<Input, Output>
    | RemoteActionMeta,
  meta?: RemoteActionMeta
): RemotePostAction<Input, Output> {
  let schema: Schema<Input> | undefined
  let runAction: RemoteActionCallback<Input, Output>
  let actionMeta: RemoteActionMeta | undefined

  if (typeof callbackOrMeta === "function") {
    schema = callbackOrValidator as Schema<Input>
    runAction = callbackOrMeta
    actionMeta = meta
  } else {
    runAction = callbackOrValidator as RemoteActionCallback<Input, Output>
    actionMeta = callbackOrMeta
  }

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
    actionMeta
  ) as RemotePostAction<Input, Output>
}

function post<Input, Output>(
  callback: RemoteActionCallback<Input, Output>
): RemotePostAction<Input, Output>
function post<Input, Output>(
  schema: Schema<Input>,
  callback: RemoteActionCallback<Input, Output>,
  meta?: RemoteActionMeta
): RemotePostAction<Input, Output>
function post<Input, Output>(
  callback: RemoteActionCallback<Input, Output>,
  meta?: RemoteActionMeta
): RemotePostAction<Input, Output>
function post<Input, Output>(
  callbackOrValidator:
    | Schema<Input>
    | RemoteActionCallback<Input, Output>,
  callbackOrMeta?: RemoteActionCallback<Input, Output> | RemoteActionMeta,
  meta?: RemoteActionMeta
): RemotePostAction<Input, Output> {
  return createPostAction(callbackOrValidator, callbackOrMeta, meta)
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

/** Create a redirect response from inside a {@link formAction} callback. */
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
  ctx: CustomRequestContext,
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
    ctx: CustomRequestContext,
    formData: FormData
  ) => Promise<Output>
}

export function formAction<Output>(
  callback: RemoteFormActionCallback<Output>,
  meta?: RemoteActionMeta
): RemoteFormActionFunction<Output> {
  return {
    __kiruFormAction: true,
    __kiruFormActionId: "",
    __kiruInvalidateRoutes: meta?.invalidate,
    __kiruRevalidate: meta?.revalidate,
    __kiruInvoke: (ctx, formData) => Promise.resolve(callback(ctx, formData)),
  }
}
