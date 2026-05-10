import type { RemoteActionFunction } from "./action.js"
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
  type RemoteActionFunction,
  type RemoteActionCallback,
  type RemoteActionSchema,
} from "./action.js"

import type { CustomRequestContext } from "../router/types.js"

const registry: Record<string, Record<string, RemoteActionFunction<unknown, unknown>>> = {}

export const __INTERNAL_REMOTE_REGISTRY = {
  register(
    id: string,
    fns: Record<string, RemoteActionFunction<unknown, unknown>>
  ): void {
    registry[id] = fns
  },
}

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
} as const

export function getRequestContext(): CustomRequestContext {
  throw new Error(
    "[kiru/remote]: `getRequestContext` has been removed. Use `action((ctx, input) => ...)` and read context from `ctx`."
  )
}

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
): value is RemoteActionFunction<unknown, unknown> {
  return !!value && typeof value === "function" && "__kiruRemoteAction" in value
}

export function createRemoteActionHandler(
  secret: string,
  options?: CreateRemoteActionHandlerOptions
): (request: Request) => Promise<Response | null> {
  return async (request: Request) => {
    try {
      if (request.method !== "POST") return null
      if (request.headers.get("content-type") !== "application/json")
        return null

      const actionId = new URL(request.url).searchParams.get("action")
      const token = request.headers.get("x-kiru-token")
      if (!actionId || !token) return null

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
      let input: unknown
      try {
        input = await request.json()
      } catch {
        return new Response(null, { status: 500 })
      }
      if (typeof handler !== "function") {
        return new Response(null, { status: 500 })
      }
      if (!isWrappedRemoteAction(handler)) {
        return new Response(null, { status: 500 })
      }

      try {
        const result = await handler.__kiruInvoke(context, input)
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: jsonHeaders,
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
    } catch {
      return new Response(null, { status: 500 })
    }
  }
}
