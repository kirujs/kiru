import type { CustomRequestContext } from "../router/types.js"

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

/** Returned by {@link redirect} inside a remote handler to trigger a server-side redirect. */
export type KiruRedirect = {
  readonly __kiruRedirect: true
  readonly status: number
  readonly location: string
  readonly cookies?: readonly KiruSetCookie[]
  readonly context?: CustomRequestContext
}

/** Create a redirect response from inside a remote handler. */
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
