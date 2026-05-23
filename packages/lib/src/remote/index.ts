import type {
  RemoteActionInvokeArgs,
  RemoteFormActionFunction,
  RemoteFormActionInvokeArgs,
} from "./action.js"
import {
  KIRU_FORM_TOKEN_FIELD,
  parseActionQueryFromUrl,
} from "./action.js"
import { buildActionHttpResponse, normalizeActionResult } from "./actionResponse.js"
import type { HandlerWithScopeResult } from "./actionResponseScope.js"
import {
  createActionExecutionForRequest,
  runInActionExecution,
} from "./actionInvokeScope.js"
import { isAbortError } from "../router/navigationScope.js"
import { isRemoteError } from "./errors.js"
import { unwrapKiruToken } from "./token.js"

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
  type KiruSetCookie,
  type KiruActionResponseOptions,
  type RemoteActionFunction,
  type RemoteAction,
  type RemoteJsonActionConfig,
  type RemoteFormActionConfig,
  type RemoteFormActionConfigWithBody,
  type RemoteFormActionHandlerWithBody,
  isRemoteJsonAction,
  isRemoteFormAction,
  type RemoteActionHandler,
  type RemoteActionHandlerArgs,
  type RemoteActionInvokeArgs,
  type RemoteActionCallOptions,
  type RemoteActionValidationConfig,
  type InferActionConfigBody,
  type InferActionConfigQuery,
  type InferActionConfigOutput,
  type InferSchemaOutput,
  type ActionMiddleware,
  type ActionMiddlewareContext,
  parseActionQueryFromUrl,
  serializeActionCallQuery,
  type RemoteFormActionHandler,
  type RemoteFormActionHandlerArgs,
  type RemoteFormActionInvokeArgs,
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
  type RequestEnvelope,
  type RuntimeContext,
  type ExecutionState,
  type MiddlewareState,
  type CacheScope,
  type TraceContext,
  type TraceSpan,
  type Transaction,
  createActionExecution,
  createActionFrame,
  createCacheScope,
  createTraceContext,
  listActionFrames,
  headersToValidationInput,
  formDataToInput,
  buildRemoteActionHandlerArgs,
  type RemoteActionInput,
  type ActionCookies,
  type ActionCookieDefaults,
  type ActionCookieSetOptions,
  type FormActionClientOutput,
} from "./action.js"

export {
  KIRU_TOKEN_RESPONSE_HEADER,
  normalizeActionResult,
  buildActionHttpResponse,
  serializeSetCookie,
} from "./actionResponse.js"

export {
  getActionExecutionContext,
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

export {
  ActionDispatchError,
  isActionDispatchError,
  RemoteError,
  isRemoteError,
} from "./errors.js"

type RegisteredRemoteAction = {
  __kiruRemoteAction: true
  __kiruInvalidateRoutes?: string[]
  __kiruRevalidate?: import("./action.js").RemoteRevalidateMeta
  __kiruInvoke: (args: RemoteActionInvokeArgs) => Promise<HandlerWithScopeResult>
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

export type CreateRemoteActionHandlerOptions = {
  allowedOrigins?: string[]
  exposeErrors?: boolean
  deployTarget?: import("@kirujs/runtime").KiruDeployTarget
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
  return (
    !!value &&
    typeof value === "function" &&
    "__kiruRemoteAction" in value &&
    (value as unknown as RegisteredRemoteAction).__kiruRemoteAction === true
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

async function buildResponseFromInvoke(
  handlerResult: unknown,
  meta: import("./actionResponseScope.js").CommittedResponseMeta,
  secret: string,
  options: CreateRemoteActionHandlerOptions | undefined,
  init: {
    isEnhanced: boolean
    referer?: string
    extraHeaders?: Record<string, string>
  }
): Promise<Response> {
  const normalized = normalizeActionResult(handlerResult, meta)
  return buildActionHttpResponse({
    normalized,
    secret,
    deployTarget: options?.deployTarget,
    isEnhanced: init.isEnhanced,
    referer: init.referer,
    extraHeaders: init.extraHeaders,
    committed: meta,
  })
}

async function invokeJsonRemoteAction(
  handler: RegisteredRemoteAction,
  request: Request,
  context: import("../router/types.js").CustomRequestContext,
  body: unknown,
  query: Record<string, string | string[]>,
  rpcActionId: string,
  secret: string,
  options?: CreateRemoteActionHandlerOptions
): Promise<Response> {
  const execution = createActionExecutionForRequest({
    context,
    signal: request.signal,
    request,
    headers: request.headers,
    body,
    query,
    entryActionId: rpcActionId,
  })
  const handlerArgs: RemoteActionInvokeArgs = {
    body,
    query,
    context: execution.request.context,
    signal: execution.request.signal,
    request,
    execution,
  }
  try {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 })
    }
    const { handlerResult, meta } = await runInActionExecution(execution, () =>
      handler.__kiruInvoke(handlerArgs)
    )
    const { applyServerRevalidate } = await import("../router/revalidate.js")
    await applyServerRevalidate(handler.__kiruRevalidate)
    return buildResponseFromInvoke(handlerResult, meta, secret, options, {
      isEnhanced: true,
      extraHeaders: invalidateHeadersForAction(handler),
    })
  } catch (e) {
    if (isAbortError(e) || request.signal.aborted) {
      return new Response(null, { status: 499 })
    }
    if (isRemoteError(e)) {
      return new Response(null, { status: e.status })
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
          headers: request.headers,
          body: formData,
          entryActionId: rpcActionId,
        })
        const formArgs: RemoteFormActionInvokeArgs = {
          formData,
          signal: execution.request.signal,
        }
        try {
          if (request.signal.aborted) {
            return new Response(null, { status: 499 })
          }
          const { handlerResult, meta } = await runInActionExecution(
            execution,
            () => handler.__kiruInvoke(formArgs)
          )
          const { applyServerRevalidate } = await import("../router/revalidate.js")
          await applyServerRevalidate(handler.__kiruRevalidate)
          const isEnhanced = !!request.headers.get("x-kiru-form")
          return buildResponseFromInvoke(handlerResult, meta, secret, options, {
            isEnhanced,
            referer: request.headers.get("referer") ?? "/",
            extraHeaders: invalidateHeadersForAction(handler),
          })
        } catch (e) {
          if (isAbortError(e) || request.signal.aborted) {
            return new Response(null, { status: 499 })
          }
          if (isRemoteError(e)) {
            return new Response(null, { status: e.status })
          }
          return new Response(null, { status: 500 })
        }
      }

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
        return new Response(null, { status: 403 })
      }

      const context = unwrapKiruToken(token, secret)
      if (!context) return new Response(null, { status: 400 })

      const handler = registry[routeId]?.[actionName]
      if (!isWrappedRemoteAction(handler)) {
        return new Response(null, { status: 500 })
      }

      if (request.method !== "POST") {
        return new Response(null, { status: 405 })
      }

      let body: unknown = undefined
      try {
        body = await request.json()
      } catch {
        body = null
      }

      const query = parseActionQueryFromUrl(url)
      return invokeJsonRemoteAction(
        handler,
        request,
        context,
        body,
        query,
        actionId,
        secret,
        options
      )
    } catch {
      return new Response(null, { status: 500 })
    }
  }
}
