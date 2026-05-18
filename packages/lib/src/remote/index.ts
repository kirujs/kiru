import type { RemoteFormActionFunction } from "./action.js"
import { isRemoteError } from "./errors.js"
import { isKiruRedirect, KIRU_FORM_TOKEN_FIELD } from "./action.js"
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
  formAction,
  redirect,
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  type RemoteActionFunction,
  type RemoteGetAction,
  type RemotePostAction,
  type RemoteActionMethod,
  type RemoteActionOptions,
  type RemoteActionCallback,
  type RemoteActionSchema,
  type ActionSchema,
  type Schema,
  type KiruSchemaInput,
  type KiruValidator,
  type KiruValidationResult,
  type StandardJSONSchema,
  type StandardJSONSchemaV1,
  type StandardSchema,
  type StandardSchemaV1,
  type StandardSchemaWithJson,
  assertValid,
  parseInput,
  isStandardJSONSchemaV1,
  isStandardSchemaV1,
  toInputJsonSchema,
  toOutputJsonSchema,
  type RemoteFormActionFunction,
  type RemoteFormActionCallback,
  type KiruRedirect,
} from "./action.js"

export {
  createFormController,
  type CreateFormControllerResult,
} from "./formController.js"

type RegisteredRemoteAction = {
  __kiruRemoteAction: true
  __kiruRemoteMethod: import("./action.js").RemoteActionMethod
  __kiruInvalidateRoutes?: string[]
  __kiruInvoke: (
    ctx: import("../router/types.js").CustomRequestContext,
    input: unknown
  ) => Promise<unknown>
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
  return method === "GET" || method === "POST"
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
  context: import("../router/types.js").CustomRequestContext,
  input: unknown,
  options?: CreateRemoteActionHandlerOptions
): Promise<Response> {
  try {
    const result = await handler.__kiruInvoke(context, input)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...jsonHeaders, ...invalidateHeadersForAction(handler) },
    })
  } catch (e) {
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

        try {
          const result = await handler.__kiruInvoke(context, formData)
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
      // JSON remote action (GET or POST)
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

      if (handler.__kiruRemoteMethod === "POST" && contentType !== "application/json") {
        return null
      }

      let input: unknown
      if (handler.__kiruRemoteMethod === "POST") {
        try {
          input = await request.json()
        } catch {
          return new Response(null, { status: 500 })
        }
      }

      return invokeJsonRemoteAction(handler, context, input, options)
    } catch {
      return new Response(null, { status: 500 })
    }
  }
}
