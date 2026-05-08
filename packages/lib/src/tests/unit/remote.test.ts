import { describe, it } from "node:test"
import assert from "node:assert"
import { makeKiruContextToken, unwrapKiruToken } from "../../remote/token.js"
import {
  __INTERNAL_REMOTE_REGISTRY,
  createRemoteActionHandler,
  getRequestContext,
} from "../../remote/index.js"

const SECRET = "test-secret-abc"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  actionId: string,
  token: string,
  body: unknown = [],
  overrides: RequestInit = {}
): Request {
  return new Request(`http://localhost/?action=${actionId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kiru-token": token,
    },
    body: JSON.stringify(body),
    ...overrides,
  })
}

function validToken(ctx: Record<string, unknown> = {}) {
  return makeKiruContextToken(ctx, SECRET)
}

// ---------------------------------------------------------------------------
// token.ts
// ---------------------------------------------------------------------------

describe("remote / token", () => {
  it("makeKiruContextToken produces a three-part base64url token", () => {
    const token = makeKiruContextToken({ user: "alice" }, SECRET)
    const parts = token.split(".")
    assert.strictEqual(parts.length, 3, "should have header.payload.sig")
    for (const part of parts) {
      assert.match(part, /^[A-Za-z0-9\-_]+$/, "each part should be base64url")
    }
  })

  it("makeKiruContextToken throws when secret is empty", () => {
    assert.throws(() => makeKiruContextToken({}, ""), /secret required/)
  })

  it("unwrapKiruToken round-trips context through make/unwrap", () => {
    const ctx = { user: "bob", role: "admin", count: 42 }
    const token = makeKiruContextToken(ctx, SECRET)
    const result = unwrapKiruToken(token, SECRET)
    assert.deepStrictEqual(result, ctx)
  })

  it("unwrapKiruToken returns null for a wrong secret", () => {
    const token = makeKiruContextToken({ user: "carol" }, SECRET)
    assert.strictEqual(unwrapKiruToken(token, "wrong-secret"), null)
  })

  it("unwrapKiruToken returns null for a tampered payload", () => {
    const token = makeKiruContextToken({ user: "dave" }, SECRET)
    const [h, , s] = token.split(".")
    const fakePayload = Buffer.from(
      JSON.stringify({ iat: 0, ctx: { user: "hacker" } })
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    const tampered = `${h}.${fakePayload}.${s}`
    assert.strictEqual(unwrapKiruToken(tampered, SECRET), null)
  })

  it("unwrapKiruToken returns null for a token with wrong part count", () => {
    assert.strictEqual(unwrapKiruToken("only.two", SECRET), null)
    assert.strictEqual(unwrapKiruToken("a.b.c.d", SECRET), null)
  })

  it("unwrapKiruToken returns null for a completely garbage string", () => {
    assert.strictEqual(unwrapKiruToken("not-a-token", SECRET), null)
  })

  it("unwrapKiruToken returns null when typ is not KRT", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    const payload = Buffer.from(JSON.stringify({ iat: Date.now(), ctx: {} }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    // signature won't match but typ check fires first
    assert.strictEqual(
      unwrapKiruToken(`${header}.${payload}.fakesig`, SECRET),
      null
    )
  })
})

// ---------------------------------------------------------------------------
// remote/index.ts — registry + handler
// ---------------------------------------------------------------------------

describe("remote / handler", () => {
  it("returns null for non-POST requests", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const req = new Request("http://localhost/?action=x:y", { method: "GET" })
    assert.strictEqual(await handler(req), null)
  })

  it("returns null when content-type is not application/json", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const req = new Request("http://localhost/?action=x:y", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-kiru-token": token },
      body: "[]",
    })
    assert.strictEqual(await handler(req), null)
  })

  it("returns null when action query param is missing", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json", "x-kiru-token": token },
      body: "[]",
    })
    assert.strictEqual(await handler(req), null)
  })

  it("returns null when x-kiru-token header is missing", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const req = new Request("http://localhost/?action=x:y", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "[]",
    })
    assert.strictEqual(await handler(req), null)
  })

  it("returns 500 when action ID has no colon separator", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const req = makeRequest("no-colon-here", token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 500 when token is invalid", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const req = makeRequest("route:fn", "not.a.valid.token")
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 500 when body is not a JSON array", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/body-not-array"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, { fn: async () => "ok" })
    const req = new Request(`http://localhost/?action=${routeId}:fn`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-kiru-token": token },
      body: JSON.stringify({ not: "an array" }),
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 500 when the action is not registered", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const req = makeRequest("unknown/route:unknownFn", token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 500 when the registered value is not a function", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/not-a-function"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: "not a function" as unknown as () => void,
    })
    const req = makeRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("dispatches to the registered action and returns JSON result", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/dispatch"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      greet: async (name: unknown) => `hello ${name}`,
    })
    const req = makeRequest(`${routeId}:greet`, token, ["world"])
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.strictEqual(
      res?.headers.get("content-type"),
      "application/json; charset=utf-8"
    )
    const body = await res?.json()
    assert.strictEqual(body, "hello world")
  })

  it("passes all positional args to the action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/multi-args"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      add: async (a: unknown, b: unknown) => (a as number) + (b as number),
    })
    const req = makeRequest(`${routeId}:add`, token, [3, 7])
    const res = await handler(req)
    const body = await res?.json()
    assert.strictEqual(body, 10)
  })

  it("returns 500 when the action throws", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/throws"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      boom: async () => {
        throw new Error("intentional error")
      },
    })
    const req = makeRequest(`${routeId}:boom`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("provides request context to getRequestContext() inside the action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const ctx = { user: { name: "Eve" }, role: "editor" }
    const token = makeKiruContextToken(ctx, SECRET)
    const routeId = "test/get-context"
    let captured: unknown = null
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      whoami: async () => {
        captured = getRequestContext()
        return "done"
      },
    })
    const req = makeRequest(`${routeId}:whoami`, token)
    await handler(req)
    assert.deepStrictEqual(captured, ctx)
  })

  it("getRequestContext() throws when called outside an action", () => {
    assert.throws(
      () => getRequestContext(),
      /Invalid `getRequestContext` invocation/
    )
  })

  it("__kiruRegister overwrites an existing registration for the same route", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/overwrite"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, { fn: async () => "first" })
    __INTERNAL_REMOTE_REGISTRY.register(routeId, { fn: async () => "second" })
    const req = makeRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    const body = await res?.json()
    assert.strictEqual(body, "second")
  })
})
