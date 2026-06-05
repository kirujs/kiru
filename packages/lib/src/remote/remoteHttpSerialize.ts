import type { CustomRequestContext } from "../router/types.js"
import { isEdgeDeployTarget, type KiruDeployTarget } from "@kirujs/runtime"
import {
  isKiruRedirect,
  type KiruActionResponseOptions,
  type KiruRedirect,
  type KiruSetCookie,
} from "./action.js"
import type { CommittedResponseMeta } from "./remoteResponseScope.js"
import { KIRU_TOKEN_RESPONSE_HEADER } from "./remoteHeaders.js"
import { makeKiruContextToken, makeKiruContextTokenAsync } from "./token.js"

export { KIRU_TOKEN_RESPONSE_HEADER } from "./remoteHeaders.js"

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

export type NormalizedActionResult =
  | {
      kind: "redirect"
      redirect: KiruRedirect
      jsonBody: KiruRedirectJsonBody
      meta: KiruActionResponseOptions
    }
  | {
      kind: "json"
      body: unknown
      meta: KiruActionResponseOptions
    }

function metaFromCommitted(scope: CommittedResponseMeta): KiruActionResponseOptions {
  const hasCookies = scope.cookies.length > 0
  const hasContext = scope.context !== undefined
  const hasHeaders = [...scope.responseHeaders.keys()].length > 0
  if (!hasCookies && !hasContext && !hasHeaders) {
    return {}
  }
  return {
    cookies: hasCookies ? scope.cookies : undefined,
    context: scope.context,
  }
}

export function normalizeRemoteResult(
  handlerResult: unknown,
  committed: CommittedResponseMeta
): NormalizedActionResult {
  const meta = metaFromCommitted(committed)

  if (isKiruRedirect(handlerResult)) {
    return {
      kind: "redirect",
      redirect: handlerResult,
      jsonBody: redirectJsonBody(handlerResult),
      meta,
    }
  }

  return {
    kind: "json",
    body: handlerResult,
    meta,
  }
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
  deployTarget?: KiruDeployTarget,
  extraResponseHeaders?: Headers
): Promise<void> {
  if (extraResponseHeaders) {
    extraResponseHeaders.forEach((value, name) => {
      headers.append(name, value)
    })
  }
  if (!meta) return
  appendSetCookies(headers, meta.cookies)
  if (meta.context !== undefined) {
    const token = await signContextToken(meta.context, secret, deployTarget)
    headers.set(KIRU_TOKEN_RESPONSE_HEADER, token)
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
  committed?: CommittedResponseMeta
}

export async function buildRemoteHttpResponse(
  params: BuildActionHttpResponseParams
): Promise<Response> {
  const {
    normalized,
    secret,
    deployTarget,
    isEnhanced,
    referer,
    extraHeaders,
    committed,
  } = params

  const responseHeaders = committed?.responseHeaders

  if (normalized.kind === "redirect") {
    const { redirect, jsonBody, meta } = normalized
    if (isEnhanced) {
      const headers = new Headers({ "content-type": jsonContentType })
      await appendActionResponseMetadata(
        headers,
        meta,
        secret,
        deployTarget,
        responseHeaders
      )
      if (extraHeaders) {
        for (const [k, v] of Object.entries(extraHeaders)) {
          headers.set(k, v)
        }
      }
      return new Response(JSON.stringify(jsonBody), { status: 200, headers })
    }
    const headers = new Headers({ Location: redirect.location })
    await appendActionResponseMetadata(
      headers,
      meta,
      secret,
      deployTarget,
      responseHeaders
    )
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        headers.set(k, v)
      }
    }
    return new Response(null, { status: redirect.status, headers })
  }

  const { body, meta } = normalized
  if (isEnhanced) {
    const headers = new Headers({ "content-type": jsonContentType })
    await appendActionResponseMetadata(
      headers,
      meta,
      secret,
      deployTarget,
      responseHeaders
    )
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        headers.set(k, v)
      }
    }
    return new Response(JSON.stringify(body), { status: 200, headers })
  }

  const headers = new Headers({ Location: referer ?? "/" })
  await appendActionResponseMetadata(
    headers,
    meta,
    secret,
    deployTarget,
    responseHeaders
  )
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k, v)
    }
  }
  return new Response(null, { status: 303, headers })
}
