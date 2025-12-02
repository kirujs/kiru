import crypto from "crypto"

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
  ctx: Record<string, unknown>
}

export function makeKiruContextToken(
  ctx: Record<string, unknown>,
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

// On the RPC endpoint (server-side):
export function unwrapKiruToken(
  token: string,
  secret: string
): Record<string, unknown> | null {
  const payload = verifySignedTokenHmac(token, secret)
  if (!payload) return null
  return payload.ctx
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
