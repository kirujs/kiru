import { describe, it } from "node:test"
import assert from "node:assert"
import {
  makeKiruContextToken,
  makeKiruContextTokenAsync,
  unwrapKiruToken,
  unwrapKiruTokenAsync,
} from "../../remote/token.js"
import {
  __INTERNAL_REMOTE_REGISTRY,
  action,
  createRemoteActionHandler,
  RemoteError,
  type RemoteActionFunction,
} from "../../remote/index.js"

const SECRET = "test-secret-abc"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  actionId: string,
  token: string,
  body: unknown = null,
  overrides: RequestInit = {}
): Request {
  const payload = body === undefined ? null : body
  return new Request(`http://localhost/?action=${actionId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kiru-token": token,
    },
    body: JSON.stringify(payload),
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

describe("remote / token (async / webcrypto)", () => {
  it("makeKiruContextTokenAsync round-trips with unwrapKiruTokenAsync", async () => {
    if (!globalThis.crypto?.subtle) return
    const ctx = { n: 1 }
    const token = await makeKiruContextTokenAsync(ctx, SECRET)
    const out = await unwrapKiruTokenAsync(token, SECRET)
    assert.deepStrictEqual(out, ctx)
  })

  it("async token verifies with sync unwrapKiruToken on Node", async () => {
    if (!globalThis.crypto?.subtle) return
    const ctx = { n: 2 }
    const token = await makeKiruContextTokenAsync(ctx, SECRET)
    assert.deepStrictEqual(unwrapKiruToken(token, SECRET), ctx)
  })
})

// ---------------------------------------------------------------------------
// remote/index.ts — handler options
// ---------------------------------------------------------------------------

describe("remote / handler — options", () => {
  it("403 when allowedOrigins is set and Origin header mismatches", async () => {
    const handler = createRemoteActionHandler(SECRET, {
      allowedOrigins: ["https://trusted.example"],
    })
    const token = validToken()
    const routeId = "test/origin"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async (_ctx, _input: void) => "ok") as RemoteActionFunction<unknown, unknown>,
    })
    const req = new Request(`http://localhost/?action=${routeId}:fn`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiru-token": token,
        origin: "http://evil.com",
      },
      body: JSON.stringify(null),
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 403)
  })

  it("allows request when Origin matches allowedOrigins", async () => {
    const handler = createRemoteActionHandler(SECRET, {
      allowedOrigins: ["http://localhost"],
    })
    const token = validToken()
    const routeId = "test/origin-ok"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async (_ctx, _input: void) => "yes") as RemoteActionFunction<unknown, unknown>,
    })
    const req = new Request(`http://localhost/?action=${routeId}:fn`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiru-token": token,
        origin: "http://localhost",
      },
      body: JSON.stringify(null),
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
  })

  it("returns FORBIDDEN_ORIGIN JSON when exposeErrors and origin blocked", async () => {
    const handler = createRemoteActionHandler(SECRET, {
      allowedOrigins: ["https://only.here"],
      exposeErrors: true,
    })
    const token = validToken()
    const routeId = "test/forbidden-json"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async (_ctx, _input: void) => "x") as RemoteActionFunction<unknown, unknown>,
    })
    const req = new Request(`http://localhost/?action=${routeId}:fn`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiru-token": token,
        origin: "http://localhost",
      },
      body: JSON.stringify(null),
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 403)
    const j = (await res?.json()) as { error: { code: string } }
    assert.strictEqual(j.error.code, "FORBIDDEN_ORIGIN")
  })

  it("exposes RemoteError as JSON when exposeErrors is true", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/remote-err"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      boom: action(async (_ctx, _input: void) => {
        throw new RemoteError("nope", "TEST_CODE", { status: 422 })
      }) as RemoteActionFunction<any, never>,
    })
    const req = makeRequest(`${routeId}:boom`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 422)
    const j = (await res?.json()) as { error: { code: string } }
    assert.strictEqual(j.error.code, "TEST_CODE")
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
      body: "null",
    })
    assert.strictEqual(await handler(req), null)
  })

  it("returns null when action query param is missing", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json", "x-kiru-token": token },
      body: "null",
    })
    assert.strictEqual(await handler(req), null)
  })

  it("returns null when x-kiru-token header is missing", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const req = new Request("http://localhost/?action=x:y", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
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

  it("returns 500 when body is not valid JSON", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/body-invalid-json"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async (_ctx, _input: void) => "ok") as RemoteActionFunction<unknown, unknown>,
    })
    const req = new Request(`http://localhost/?action=${routeId}:fn`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-kiru-token": token },
      body: "not-json",
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
      // @ts-expect-error - not a function
      fn: "not a function",
    })
    const req = makeRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 500 when the registered handler is not wrapped with action()", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/not-wrapped"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      // @ts-expect-error - not a wrapped function
      fn: async (_a: unknown) => "legacy",
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
      greet: action(async (_ctx, name: string) => `hello ${name}`) as RemoteActionFunction<any, string>,
    })
    const req = makeRequest(`${routeId}:greet`, token, "world")
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.strictEqual(
      res?.headers.get("content-type"),
      "application/json; charset=utf-8"
    )
    const body = await res?.json()
    assert.strictEqual(body, "hello world")
  })

  it("dispatches a single JSON input (e.g. tuple) to the action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/tuple-input"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      add: action(
        async (_ctx, input: readonly [number, number]) => input[0]! + input[1]!
      ) as RemoteActionFunction<any, number>,
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
      boom: action(async (_ctx, _input: void) => {
        throw new Error("intentional error")
      }) as RemoteActionFunction<any, never>,
    })
    const req = makeRequest(`${routeId}:boom`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("provides request context after await in async action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const ctx = { ping: "pong" }
    const token = makeKiruContextToken(ctx as Record<string, unknown>, SECRET)
    const routeId = "test/ctx-after-await"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      delayed: action(async (ctx, _input: void) => {
        await new Promise<void>((r) => setTimeout(r, 5))
        return (ctx as { ping?: string }).ping
      }) as RemoteActionFunction<any, string>,
    })
    const req = makeRequest(`${routeId}:delayed`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.strictEqual(await res?.json(), "pong")
  })

  it("injects request context as the first action callback argument", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const ctx = { user: { name: "Eve" }, role: "editor" }
    const token = makeKiruContextToken(ctx, SECRET)
    const routeId = "test/get-context"
    let captured: unknown = null
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      whoami: action(async (ctx, _input: void) => {
        captured = ctx
        return "done"
      }) as RemoteActionFunction<any, string>,
    })
    const req = makeRequest(`${routeId}:whoami`, token)
    await handler(req)
    assert.deepStrictEqual(captured, ctx)
  })

  it("validates action input via schema.parse", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/schema-guard"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      greet: action(
        {
          parse: (input: unknown): input is { name: string } =>
            !!input &&
            typeof input === "object" &&
            "name" in input &&
            typeof (input as { name?: unknown }).name === "string",
        },
        async (_ctx, input) => `hello ${input.name}`
      ) as RemoteActionFunction<any, string>,
    })
    const req = makeRequest(`${routeId}:greet`, token, { wrong: true })
    const res = await handler(req)
    assert.strictEqual(res?.status, 400)
    const j = (await res?.json()) as { error: { code: string } }
    assert.strictEqual(j.error.code, "INVALID_INPUT")
  })

  it("__kiruRegister overwrites an existing registration for the same route", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/overwrite"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async (_ctx, _input: void) => "first") as RemoteActionFunction<unknown, unknown>,
    })
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async (_ctx, _input: void) => "second") as RemoteActionFunction<unknown, unknown>,
    })
    const req = makeRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    const body = await res?.json()
    assert.strictEqual(body, "second")
  })
})
