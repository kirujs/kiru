import type {
  RemoteActionInvokeArgs,
  RemoteFormActionFunction,
  RemoteFormActionHandlerArgs,
} from "./action.js"
import {
  isKiruRedirect,
  isRemoteActionBodyMethod,
  KIRU_FORM_TOKEN_FIELD,
} from "./action.js"
import {
  createActionExecutionForRequest,
  runInActionExecution,
  toRemoteActionHandlerArgs,
} from "./actionInvokeScope.js"
import { isAbortError } from "../router/navigationScope.js"
import { isRemoteError } from "./errors.js"
import { unwrapKiruToken } from "./token.js"

export { RemoteError, isRemoteError } from "./errors.js"
export {
  makeKiruContextToken,
  makeKiruContextTokenAsync,
  unwrapKiruToken,
  unwrapKiruTokenAsync,
} from "./token.js"
export type { TokenHeader, TokenPayload } from "./token.js"

export {
  action,
  redirect,
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  type RemoteActionFunction,
  type RemoteGetAction,
  type RemoteBodyAction,
  type RemoteJsonActionConfig,
  type RemoteFormActionConfig,
  type RemoteActionMethod,
  isRemoteActionBodyMethod,
  isRemoteGetAction,
  isRemoteBodyAction,
  isRemoteFormAction,
  type RemoteActionHandler,
  type RemoteActionHandlerArgs,
  type RemoteActionInvokeArgs,
  type RemoteActionCallOptions,
  type RemoteFormActionHandler,
  type RemoteFormActionHandlerArgs,
  type ActionSchema,
  type Schema,
  type StandardJSONSchema,
  type StandardJSONSchemaV1,
  type StandardSchema,
  type StandardSchemaV1,
  type StandardSchemaWithJson,
  parseInput,
  isStandardJSONSchemaV1,
  isStandardSchemaV1,
  toInputJsonSchema,
  toOutputJsonSchema,
  type RemoteFormActionFunction,
  type KiruRedirect,
  type RemoteRevalidateMeta,
  type RemoteActionMeta,
  type ActionExecution,
  type ActionExecutionFrame,
  type RequestExecutionContext,
  type ActionRuntimeContext,
  type CacheScope,
  type TraceContext,
  type TraceSpan,
  type Transaction,
  createActionExecution,
  createActionFrame,
  createCacheScope,
  createTraceContext,
  listActionFrames,
  formDataToInput,
  buildRemoteActionHandlerArgs,
} from "./action.js"

export {
  getActiveActionExecution,
  getActiveActionContext,
  runInActionExecution,
  runWithActionFrame,
  toRemoteActionHandlerArgs,
  createActionExecutionForRequest,
} from "./actionInvokeScope.js"

export {
  createFormController,
  type CreateFormControllerResult,
} from "./formController.js"

type RegisteredRemoteAction = {
  __kiruRemoteAction: true
  __kiruRemoteMethod: import("./action.js").RemoteActionMethod
  __kiruInvalidateRoutes?: string[]
  __kiruRevalidate?: import("./action.js").RemoteRevalidateMeta
  __kiruInvoke: (args: RemoteActionInvokeArgs) => Promise<unknown>
}

type AnyRegisteredAction =
  | RegisteredRemoteAction
  | RemoteFormActionFunction<unknown>

const registry: Record<string, Record<string, AnyRegisteredAction>> = {}

export const __INTERNAL_REMOTE_REGISTRY = {
  register(
    id: string,
    fns: Record<string, AnyRegisteredAction>
  ): void {
    registry[id] = fns
  },
}

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
} as const

export type CreateRemoteActionHandlerOptions = {
  /**
   * If non-empty, require `Origin` or `Referer` to match one of these strings
   * (exact origin, e.g. `https://app.example.com`). Use `"*"` to disable the check.
   */
  allowedOrigins?: string[]
  /** When true, {@link RemoteError} instances become JSON `{ error: { code, message, details? } }`. */
  exposeErrors?: boolean
}

function isAllowedOrigin(
  request: Request,
  allowed: readonly string[]
): boolean {
  if (allowed.length === 0) return true
  if (allowed.includes("*")) return true
  const origin = request.headers.get("origin") ?? ""
  if (origin && allowed.includes(origin)) return true
  const referer = request.headers.get("referer")
  if (!referer) return false
  try {
    const u = new URL(referer)
    const base = `${u.protocol}//${u.host}`
    return allowed.includes(base)
  } catch {
    return false
  }
}

function isWrappedRemoteAction(
  value: unknown
): value is RegisteredRemoteAction {
  if (!value || typeof value !== "function" || !("__kiruRemoteAction" in value)) {
    return false
  }
  const method = (value as unknown as RegisteredRemoteAction).__kiruRemoteMethod
  return (
    method === "GET" ||
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE"
  )
}

function isWrappedRemoteFormAction(
  value: unknown
): value is RemoteFormActionFunction<unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruFormAction" in value &&
    (value as { __kiruFormAction: unknown }).__kiruFormAction === true
  )
}

function invalidateHeadersForAction(
  handler: RegisteredRemoteAction | RemoteFormActionFunction<unknown>
): Record<string, string> {
  const routes = handler.__kiruInvalidateRoutes
  if (!routes?.length) return {}
  return { "x-kiru-invalidate": routes.join(",") }
}

async function invokeJsonRemoteAction(
  handler: RegisteredRemoteAction,
  request: Request,
  context: import("../router/types.js").CustomRequestContext,
  input: unknown,
  rpcActionId: string,
  options?: CreateRemoteActionHandlerOptions
): Promise<Response> {
  const execution = createActionExecutionForRequest({
    context,
    signal: request.signal,
    request,
    entryActionId: rpcActionId,
  })
  const handlerArgs = toRemoteActionHandlerArgs(execution, input)
  try {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 })
    }
    const result = await runInActionExecution(execution, () =>
      handler.__kiruInvoke(handlerArgs)
    )
    const { applyServerRevalidate } = await import("../router/revalidate.js")
    await applyServerRevalidate(handler.__kiruRevalidate)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...jsonHeaders, ...invalidateHeadersForAction(handler) },
    })
  } catch (e) {
    if (isAbortError(e) || request.signal.aborted) {
      return new Response(null, { status: 499 })
    }
    if (isRemoteError(e) && options?.exposeErrors) {
      return new Response(JSON.stringify({ error: e.toJSON() }), {
        status: e.status,
        headers: jsonHeaders,
      })
    }
    return new Response(null, { status: 500 })
  }
}

export function createRemoteActionHandler(
  secret: string,
  options?: CreateRemoteActionHandlerOptions
): (request: Request) => Promise<Response | null> {
  return async (request: Request) => {
    try {
      const url = new URL(request.url)
      const actionId = url.searchParams.get("action")
      const contentType = request.headers.get("content-type") ?? ""

      // -----------------------------------------------------------------------
      // Form action: multipart/form-data or application/x-www-form-urlencoded
      // -----------------------------------------------------------------------
      if (
        actionId &&
        request.method === "POST" &&
        (contentType.includes("multipart/form-data") ||
          contentType.includes("application/x-www-form-urlencoded"))
      ) {
        const split = actionId.indexOf(":")
        if (split < 1) return new Response(null, { status: 500 })
        const routeId = actionId.slice(0, split)
        const actionName = actionId.slice(split + 1)

        const allowed = options?.allowedOrigins
        if (
          allowed &&
          allowed.length > 0 &&
          !isAllowedOrigin(request, allowed)
        ) {
          return new Response(null, { status: 403 })
        }

        let formData: FormData
        try {
          formData = await request.formData()
        } catch {
          return new Response(null, { status: 500 })
        }

        const tokenFromForm = formData.get(KIRU_FORM_TOKEN_FIELD)
        if (typeof tokenFromForm !== "string") {
          return new Response(null, { status: 400 })
        }

        const context = unwrapKiruToken(tokenFromForm, secret)
        if (!context) return new Response(null, { status: 400 })

        const handler = registry[routeId]?.[actionName]
        if (!isWrappedRemoteFormAction(handler)) {
          return new Response(null, { status: 500 })
        }

        const rpcActionId = actionId
        const execution = createActionExecutionForRequest({
          context,
          signal: request.signal,
          request,
          entryActionId: rpcActionId,
        })
        const formArgs: RemoteFormActionHandlerArgs = {
          formData,
          context: execution.request.context,
          signal: execution.request.signal,
          execution,
        }
        try {
          if (request.signal.aborted) {
            return new Response(null, { status: 499 })
          }
          const result = await runInActionExecution(execution, () =>
            handler.__kiruInvoke(formArgs)
          )
          const { applyServerRevalidate } = await import("../router/revalidate.js")
          await applyServerRevalidate(handler.__kiruRevalidate)
          const isEnhanced = !!request.headers.get("x-kiru-form")

          if (isKiruRedirect(result)) {
            if (isEnhanced) {
              return new Response(JSON.stringify(result), {
                status: 200,
                headers: jsonHeaders,
              })
            }
            return new Response(null, {
              status: result.status,
              headers: { Location: result.location },
            })
          }

          if (isEnhanced) {
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { ...jsonHeaders, ...invalidateHeadersForAction(handler) },
            })
          }
          // Native POST with a non-redirect result: redirect back to referer.
          const referer = request.headers.get("referer") ?? "/"
          return new Response(null, {
            status: 303,
            headers: { Location: referer },
          })
        } catch (e) {
          if (isAbortError(e) || request.signal.aborted) {
            return new Response(null, { status: 499 })
          }
          if (isRemoteError(e) && options?.exposeErrors) {
            return new Response(JSON.stringify({ error: e.toJSON() }), {
              status: e.status,
              headers: jsonHeaders,
            })
          }
          return new Response(null, { status: 500 })
        }
      }

      // -----------------------------------------------------------------------
      // JSON remote action (GET, POST, PUT, PATCH, DELETE)
      // -----------------------------------------------------------------------
      if (!actionId) return null

      const token = request.headers.get("x-kiru-token")
      if (!token) return null

      const split = actionId.indexOf(":")
      if (split < 1) {
        return new Response(null, { status: 500 })
      }
      const routeId = actionId.slice(0, split)
      const actionName = actionId.slice(split + 1)

      const allowed = options?.allowedOrigins
      if (allowed && allowed.length > 0 && !isAllowedOrigin(request, allowed)) {
        return new Response(
          options?.exposeErrors
            ? JSON.stringify({
                error: {
                  code: "FORBIDDEN_ORIGIN",
                  message: "Request origin is not allowed",
                },
              })
            : null,
          {
            status: 403,
            headers: options?.exposeErrors ? jsonHeaders : {},
          }
        )
      }

      const context = unwrapKiruToken(token, secret)
      if (!context) {
        return new Response(null, { status: 500 })
      }

      const handler = registry[routeId]?.[actionName]
      if (!isWrappedRemoteAction(handler)) {
        return new Response(null, { status: 500 })
      }

      if (request.method !== handler.__kiruRemoteMethod) {
        return null
      }

      if (
        isRemoteActionBodyMethod(handler.__kiruRemoteMethod) &&
        contentType !== "application/json"
      ) {
        return null
      }

      let input: unknown
      if (isRemoteActionBodyMethod(handler.__kiruRemoteMethod)) {
        try {
          input = await request.json()
        } catch {
          return new Response(null, { status: 500 })
        }
      }

      const rpcActionId = `${routeId}:${actionName}`
      return invokeJsonRemoteAction(
        handler,
        request,
        context,
        input,
        rpcActionId,
        options
      )
    } catch {
      return new Response(null, { status: 500 })
    }
  }
}
