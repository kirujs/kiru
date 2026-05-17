import crypto from "node:crypto"
import { CustomRequestContext } from "../router/types.js"

/* ----------------------------- Token Format ---------------------------
Compact format (inspired by JWT):
token = base64url(header) + "." + base64url(payload) + "." + base64url(signature)


header = { alg: "HS256" | "ED25519", typ: "KRT" }
payload = { iat: number, exp?: number, ctx: { ...small context... } }


Keep payload compact: only values necessary to reconstruct context on RPC.
-----------------------------------------------------------------------*/

export type TokenHeader = { alg: "HS256" | "ED25519"; typ: "KRT" }
export type TokenPayload = {
  iat: number
  ctx: CustomRequestContext
}

export function makeKiruContextToken(
  ctx: CustomRequestContext,
  secret: string
): string {
  const iat = Date.now()
  const payload: TokenPayload = {
    iat,
    ctx,
  }
  if (!secret) throw new Error("secret required")
  return createSignedTokenHmac(payload, secret)
}

/**
 * Edge / Web Crypto path — same token format as {@link makeKiruContextToken}
 * but uses `globalThis.crypto.subtle` (Workers, modern browsers, Node 19+).
 */
export async function makeKiruContextTokenAsync(
  ctx: Record<string, unknown>,
  secret: string
): Promise<string> {
  const iat = Date.now()
  const payload: TokenPayload = { iat, ctx }
  if (!secret) throw new Error("secret required")
  const subtle = getSubtle()
  if (!subtle) {
    throw new Error(
      "[kiru/remote]: crypto.subtle unavailable; use makeKiruContextToken on Node or enable Web Crypto"
    )
  }
  return createSignedTokenHmacWeb(subtle, payload, secret)
}

// On the RPC endpoint (server-side):
export function unwrapKiruToken(
  token: string,
  secret: string
): CustomRequestContext | null {
  const payload = verifySignedTokenHmac(token, secret)
  if (!payload) return null
  return payload.ctx
}

/** Async verify using Web Crypto (pairs with {@link makeKiruContextTokenAsync}). */
export async function unwrapKiruTokenAsync(
  token: string,
  secret: string
): Promise<CustomRequestContext | null> {
  const subtle = getSubtle()
  if (!subtle) return unwrapKiruToken(token, secret)
  const payload = await verifySignedTokenHmacWeb(subtle, token, secret)
  if (!payload) return null
  return payload.ctx
}

function getSubtle(): SubtleCrypto | null {
  const c = globalThis.crypto
  return c && "subtle" in c && c.subtle ? c.subtle : null
}

function createSignedTokenHmac(payload: TokenPayload, secret: string): string {
  const header: TokenHeader = { alg: "HS256", typ: "KRT" }
  const headerB = Buffer.from(JSON.stringify(header), "utf8")
  const payloadB = Buffer.from(JSON.stringify(payload), "utf8")
  const signingInput = `${base64UrlEncode(headerB)}.${base64UrlEncode(
    payloadB
  )}`

  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest()
  return `${signingInput}.${base64UrlEncode(signature)}`
}

function verifySignedTokenHmac(
  token: string,
  secret: string
): TokenPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, sigB64] = parts
    const header = JSON.parse(
      Buffer.from(headerB64, "base64").toString("utf8")
    ) as TokenHeader
    if (header.typ !== "KRT") return null
    if (header.alg !== "HS256") return null

    const signingInput = `${headerB64}.${payloadB64}`
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(signingInput)
      .digest()
    const sig = base64UrlDecode(sigB64)

    // timing-safe compare
    if (!crypto.timingSafeEqual(expectedSig, sig)) return null

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64").toString("utf8")
    ) as TokenPayload

    return payload
  } catch (e) {
    return null
  }
}

function base64UrlEncode(buf: Uint8Array): string {
  // base64url without padding
  const b64 = Buffer.from(buf).toString("base64")
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecode(s: string): Uint8Array {
  // restore padding
  s = s.replace(/-/g, "+").replace(/_/g, "/")
  while (s.length % 4) s += "="
  return Buffer.from(s, "base64")
}

// --- Web Crypto (Workers / edge) ------------------------------------------

async function createSignedTokenHmacWeb(
  subtle: SubtleCrypto,
  payload: TokenPayload,
  secret: string
): Promise<string> {
  const header: TokenHeader = { alg: "HS256", typ: "KRT" }
  const enc = new TextEncoder()
  const headerB64 = base64UrlEncodeBytes(enc.encode(JSON.stringify(header)))
  const payloadB64 = base64UrlEncodeBytes(enc.encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`
  const key = await subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sigBuf = await subtle.sign("HMAC", key, enc.encode(signingInput))
  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(sigBuf))}`
}

async function verifySignedTokenHmacWeb(
  subtle: SubtleCrypto,
  token: string,
  secret: string
): Promise<TokenPayload | null> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, sigB64] = parts
    const enc = new TextEncoder()
    const dec = new TextDecoder()
    const headerJson = dec.decode(base64UrlDecodeBytes(headerB64))
    const header = JSON.parse(headerJson) as TokenHeader
    if (header.typ !== "KRT") return null
    if (header.alg !== "HS256") return null

    const signingInput = `${headerB64}.${payloadB64}`
    const key = await subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )
    const sigBytes = base64UrlDecodeBytes(sigB64)
    const ok = await subtle.verify(
      "HMAC",
      key,
      sigBytes as BufferSource,
      enc.encode(signingInput)
    )
    if (!ok) return null

    const payloadJson = dec.decode(base64UrlDecodeBytes(payloadB64))
    return JSON.parse(payloadJson) as TokenPayload
  } catch {
    return null
  }
}

function base64UrlEncodeBytes(buf: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    const b64 = Buffer.from(buf).toString("base64")
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  }
  let binary = ""
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!)
  const b64 = btoa(binary)
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecodeBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/")
  while (s.length % 4) s += "="
  if (typeof Buffer !== "undefined") return Buffer.from(s, "base64")
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)!
  return out
}
