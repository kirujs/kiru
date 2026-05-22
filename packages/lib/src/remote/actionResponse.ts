import type { CustomRequestContext } from "../router/types.js"
import { isEdgeDeployTarget, type KiruDeployTarget } from "@kirujs/runtime"
import {
  isKiruActionResult,
  isKiruRedirect,
  type KiruActionResponseOptions,
  type KiruRedirect,
  type KiruSetCookie,
} from "./action.js"
import {
  failWireBody,
  isKiruActionFail,
  resolveFailHttpStatus,
  type KiruActionFail,
} from "./actionFail.js"
import { makeKiruContextToken, makeKiruContextTokenAsync } from "./token.js"

export const KIRU_TOKEN_RESPONSE_HEADER = "x-kiru-token" as const

export function serializeSetCookie(c: KiruSetCookie): string {
  const parts = [
    `${c.name}=${encodeURIComponent(c.value)}`,
    `Path=${c.path ?? "/"}`,
  ]
  if (c.maxAge !== undefined) {
    parts.push(`Max-Age=${c.maxAge}`)
  }
  if (c.expires) {
    parts.push(`Expires=${c.expires.toUTCString()}`)
  }
  if (c.httpOnly) {
    parts.push("HttpOnly")
  }
  if (c.secure) {
    parts.push("Secure")
  }
  if (c.sameSite) {
    parts.push(`SameSite=${c.sameSite}`)
  }
  return parts.join("; ")
}

export function appendSetCookies(
  headers: Headers,
  cookies: readonly KiruSetCookie[] | undefined
): void {
  if (!cookies?.length) return
  for (const cookie of cookies) {
    headers.append("Set-Cookie", serializeSetCookie(cookie))
  }
}

export type NormalizedActionResult =
  | {
      kind: "redirect"
      redirect: KiruRedirect
      jsonBody: KiruRedirectJsonBody
    }
  | {
      kind: "fail"
      fail: KiruActionFail
      jsonBody: ReturnType<typeof failWireBody>
      httpStatus: number
    }
  | {
      kind: "value"
      value: unknown
      meta?: KiruActionResponseOptions
    }

export type KiruRedirectJsonBody = {
  readonly __kiruRedirect: true
  readonly status: number
  readonly location: string
}

export function redirectJsonBody(redirect: KiruRedirect): KiruRedirectJsonBody {
  return {
    __kiruRedirect: true,
    status: redirect.status,
    location: redirect.location,
  }
}

export function normalizeActionResult(result: unknown): NormalizedActionResult {
  if (isKiruRedirect(result)) {
    return {
      kind: "redirect",
      redirect: result,
      jsonBody: redirectJsonBody(result),
    }
  }
  if (isKiruActionFail(result)) {
    return {
      kind: "fail",
      fail: result,
      jsonBody: failWireBody(result),
      httpStatus: resolveFailHttpStatus(result),
    }
  }
  if (isKiruActionResult(result)) {
    return {
      kind: "value",
      value: result.value,
      meta: {
        cookies: result.cookies,
        context: result.context,
      },
    }
  }
  return { kind: "value", value: result }
}

async function signContextToken(
  context: CustomRequestContext,
  secret: string,
  deployTarget?: KiruDeployTarget
): Promise<string> {
  if (deployTarget && isEdgeDeployTarget(deployTarget)) {
    return makeKiruContextTokenAsync(
      context as Record<string, unknown>,
      secret
    )
  }
  return makeKiruContextToken(context, secret)
}

export async function appendActionResponseMetadata(
  headers: Headers,
  meta: KiruActionResponseOptions | undefined,
  secret: string,
  deployTarget?: KiruDeployTarget
): Promise<void> {
  if (!meta) return
  appendSetCookies(headers, meta.cookies)
  if (meta.context !== undefined) {
    const token = await signContextToken(meta.context, secret, deployTarget)
    headers.set(KIRU_TOKEN_RESPONSE_HEADER, token)
  }
}

export async function metadataFromRedirect(
  redirect: KiruRedirect
): Promise<KiruActionResponseOptions | undefined> {
  if (!redirect.cookies?.length && redirect.context === undefined) {
    return undefined
  }
  return {
    cookies: redirect.cookies,
    context: redirect.context,
  }
}

const jsonContentType = "application/json; charset=utf-8"

export type BuildActionHttpResponseParams = {
  normalized: NormalizedActionResult
  secret: string
  deployTarget?: KiruDeployTarget
  isEnhanced: boolean
  referer?: string
  extraHeaders?: Record<string, string>
}

export async function buildActionHttpResponse(
  params: BuildActionHttpResponseParams
): Promise<Response> {
  const { normalized, secret, deployTarget, isEnhanced, referer, extraHeaders } =
    params

  if (normalized.kind === "fail") {
    const headers = new Headers({ "content-type": jsonContentType })
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        headers.set(k, v)
      }
    }
    return new Response(JSON.stringify(normalized.jsonBody), {
      status: normalized.httpStatus,
      headers,
    })
  }

  if (normalized.kind === "redirect") {
    const { redirect, jsonBody } = normalized
    const meta = await metadataFromRedirect(redirect)
    if (isEnhanced) {
      const headers = new Headers({ "content-type": jsonContentType })
      await appendActionResponseMetadata(headers, meta, secret, deployTarget)
      if (extraHeaders) {
        for (const [k, v] of Object.entries(extraHeaders)) {
          headers.set(k, v)
        }
      }
      return new Response(JSON.stringify(jsonBody), { status: 200, headers })
    }
    const headers = new Headers({ Location: redirect.location })
    await appendActionResponseMetadata(headers, meta, secret, deployTarget)
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        headers.set(k, v)
      }
    }
    return new Response(null, { status: redirect.status, headers })
  }

  const meta = normalized.meta
  if (isEnhanced) {
    const headers = new Headers({ "content-type": jsonContentType })
    await appendActionResponseMetadata(headers, meta, secret, deployTarget)
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        headers.set(k, v)
      }
    }
    return new Response(JSON.stringify(normalized.value), {
      status: 200,
      headers,
    })
  }

  const headers = new Headers({ Location: referer ?? "/" })
  await appendActionResponseMetadata(headers, meta, secret, deployTarget)
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k, v)
    }
  }
  return new Response(null, { status: 303, headers })
}
