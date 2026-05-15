import type { CustomRequestContext } from "../router/types.js"
import { RemoteError } from "./errors.js"

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

// ---------------------------------------------------------------------------
// Remote action (JSON)
// ---------------------------------------------------------------------------

export type RemoteActionCallback<Input, Output> = (
  ctx: CustomRequestContext,
  input: Input
) => Promise<Output> | Output

export type RemoteActionSchema<Input> = {
  parse: (input: unknown) => input is Input
}

export type RemoteActionFunction<Input, Output> = ((
  input?: Input,
  options?: { signal?: AbortSignal }
) => Promise<Output>) & {
  __kiruRemoteAction: true
  __kiruInvoke: (ctx: CustomRequestContext, input: unknown) => Promise<Output>
}

export function action<Input, Output>(
  callback: RemoteActionCallback<Input, Output>
): RemoteActionFunction<Input, Output>
export function action<Input, Output>(
  schema: RemoteActionSchema<Input>,
  callback: RemoteActionCallback<Input, Output>
): RemoteActionFunction<Input, Output>
export function action<Input, Output>(
  callbackOrSchema:
    | RemoteActionSchema<Input>
    | RemoteActionCallback<Input, Output>,
  callback?: RemoteActionCallback<Input, Output>
): RemoteActionFunction<Input, Output> {
  const hasSchema = typeof callback === "function"
  const schema = hasSchema
    ? (callbackOrSchema as RemoteActionSchema<Input>)
    : undefined
  const runAction = hasSchema
    ? callback
    : (callbackOrSchema as RemoteActionCallback<Input, Output>)
  const validateActionInput = (input: unknown) => {
    if (schema && !schema.parse(input)) {
      throw new RemoteError("Invalid remote action input", "INVALID_INPUT", {
        status: 400,
      })
    }
  }
  const wrapped = (async (input?: Input): Promise<Output> => {
    validateActionInput(input)
    return runAction(_currentSsrCtx, input as Input)
  }) as RemoteActionFunction<Input, Output>

  wrapped.__kiruRemoteAction = true
  wrapped.__kiruInvoke = async (ctx, input) => {
    validateActionInput(input)
    return runAction(ctx, input as Input)
  }

  return wrapped
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
  __kiruInvoke: (
    ctx: CustomRequestContext,
    formData: FormData
  ) => Promise<Output>
}

export function formAction<Output>(
  callback: RemoteFormActionCallback<Output>
): RemoteFormActionFunction<Output> {
  return {
    __kiruFormAction: true,
    __kiruFormActionId: "",
    __kiruInvoke: (ctx, formData) => Promise.resolve(callback(ctx, formData)),
  }
}
