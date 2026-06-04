import { describe, it } from "node:test"
import assert from "node:assert"
import {
  makeKiruContextToken,
  makeKiruContextTokenAsync,
  unwrapKiruToken,
} from "../../remote/token.js"
import {
  __INTERNAL_REMOTE_REGISTRY,
  action,
  createRemoteActionHandler,
  getActionExecutionContext,
  KIRU_TOKEN_RESPONSE_HEADER,
  redirect,
} from "../../remote/index.js"
import { RemoteError } from "../../remote/errors.js"
const SECRET = "test-secret-abc"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(
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

/** JSON RPC request (POST + JSON body; query in URL when provided). */
function makeRpcRequest(
  actionId: string,
  token: string,
  overrides: RequestInit = {},
  query?: Record<string, string>,
  body: unknown = null
): Request {
  const qs = query ? `&${new URLSearchParams(query).toString()}` : ""
  const payload = body === undefined ? null : body
  return new Request(`http://localhost/?action=${actionId}${qs}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kiru-token": token,
      ...(overrides.headers as Record<string, string> | undefined),
    },
    body: JSON.stringify(payload),
    ...overrides,
  })
}

function makeGetRequest(
  actionId: string,
  token: string,
  overrides: RequestInit = {},
  query?: Record<string, string>
): Request {
  const qs = query ? `&${new URLSearchParams(query).toString()}` : ""
  return new Request(`http://localhost/?action=${actionId}${qs}`, {
    method: "GET",
    headers: {
      "x-kiru-token": token,
    },
    ...overrides,
  })
}

function validToken(ctx: Record<string, unknown> = {}) {
  return makeKiruContextToken(ctx, SECRET)
}

async function expectJsonBody(
  res: Response | null | undefined,
  body: unknown
): Promise<void> {
  assert.strictEqual(res?.status, 200)
  assert.deepStrictEqual(await res?.json(), body)
}

// ---------------------------------------------------------------------------
// token.ts
// ---------------------------------------------------------------------------

describe("remote / token", () => {
  it("makeKiruContextToken produces a three-part base64url token", () => {
    const token = makeKiruContextToken({ a: 1 }, SECRET)
    assert.strictEqual(token.split(".").length, 3)
  })

  it("unwrapKiruToken returns the original context for a valid token", () => {
    const ctx = { user: { name: "Ada" } }
    const token = makeKiruContextToken(ctx, SECRET)
    assert.deepStrictEqual(unwrapKiruToken(token, SECRET), ctx)
  })

  it("unwrapKiruToken returns null for a tampered token", () => {
    const token = makeKiruContextToken({ a: 1 }, SECRET)
    const parts = token.split(".")
    // Flip a middle signature char — the last char is often padding-equivalent
    // and does not change the decoded HMAC bytes.
    const sig = parts[2]!
    const i = Math.floor(sig.length / 2)
    parts[2] = sig.slice(0, i) + (sig[i] === "a" ? "b" : "a") + sig.slice(i + 1)
    assert.strictEqual(unwrapKiruToken(parts.join("."), SECRET), null)
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
      fn: action(async () => "ok"),
    })
    const req = makeRpcRequest(`${routeId}:fn`, token, {
      headers: {
        "x-kiru-token": token,
        origin: "http://evil.com",
      },
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
      fn: action(async () => "yes"),
    })
    const req = makeRpcRequest(`${routeId}:fn`, token, {
      headers: {
        "x-kiru-token": token,
        origin: "http://localhost",
      },
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
  })

  it("returns 403 when exposeErrors and origin blocked", async () => {
    const handler = createRemoteActionHandler(SECRET, {
      allowedOrigins: ["https://only.here"],
      exposeErrors: true,
    })
    const token = validToken()
    const routeId = "test/forbidden-json"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async () => "x"),
    })
    const req = makeRpcRequest(`${routeId}:fn`, token, {
      headers: {
        "x-kiru-token": token,
        origin: "http://localhost",
      },
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 403)
  })

  it("maps thrown RemoteError to HTTP status with empty body", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/remote-err"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      boom: action(async () => {
        throw new RemoteError("nope", "TEST_CODE", { status: 422 })
      }),
    })
    const req = makeRpcRequest(`${routeId}:boom`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 422)
    assert.strictEqual(await res?.text(), "")
  })

  it("returns handler JSON as-is on the wire", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/passthrough"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      withFields: action(async () => ({
        ok: false,
        error: { fields: { x: "nope" } },
      })),
      plain: action(async () => ({ message: "bad" })),
      auth: action(async () => ({
        ok: false,
        error: { message: "nope", code: "UNAUTHORIZED", status: 401 },
      })),
    })
    const withFields = await handler(makeRpcRequest(`${routeId}:withFields`, token))
    await expectJsonBody(withFields, {
      ok: false,
      error: { fields: { x: "nope" } },
    })

    const plain = await handler(makeRpcRequest(`${routeId}:plain`, token))
    await expectJsonBody(plain, { message: "bad" })

    const auth = await handler(makeRpcRequest(`${routeId}:auth`, token))
    await expectJsonBody(auth, {
      ok: false,
      error: { message: "nope", code: "UNAUTHORIZED", status: 401 },
    })
  })
})

// ---------------------------------------------------------------------------
// remote/index.ts — registry + handler
// ---------------------------------------------------------------------------

describe("remote / handler", () => {
  it("returns 405 when JSON RPC is invoked with GET", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/method-mismatch"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async () => "ok"),
    })
    const req = makeGetRequest(`${routeId}:fn`, token)
    assert.strictEqual((await handler(req))?.status, 405)
  })

  it("returns 405 when POST action is invoked with GET", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/post-via-get"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async ({ request }) => request.body),
    })
    const req = makeGetRequest(`${routeId}:fn`, token)
    assert.strictEqual((await handler(req))?.status, 405)
  })

  it("dispatches POST actions even when content-type is not application/json", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/wrong-content-type"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async ({ request }) => request.body),
    })
    const req = new Request(`http://localhost/?action=${routeId}:fn`, {
      method: "POST",
      headers: { "content-type": "text/plain", "x-kiru-token": token },
      body: "null",
    })
    const res = await handler(req)
    await expectJsonBody(res, null)
  })

  it("returns null when action query param is missing", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const req = new Request("http://localhost/", {
      method: "GET",
      headers: { "x-kiru-token": token },
    })
    assert.strictEqual(await handler(req), null)
  })

  it("returns null when x-kiru-token header is missing", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const req = new Request("http://localhost/?action=x:y", {
      method: "GET",
    })
    assert.strictEqual(await handler(req), null)
  })

  it("returns 500 when action ID has no colon separator", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const req = makeRpcRequest("no-colon-here", token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 400 when token is invalid", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const req = makeRpcRequest("route:fn", "not.a.valid.token")
    const res = await handler(req)
    assert.strictEqual(res?.status, 400)
  })

  it("returns 400 when JSON POST body is invalid", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/body-invalid-json"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async () => "ok"),
    })
    const req = new Request(`http://localhost/?action=${routeId}:fn`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-kiru-token": token },
      body: "not-json",
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 400)
  })

  it("returns 500 when the action is not registered", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const req = makeRpcRequest("unknown/route:unknownFn", token)
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
    const req = makeRpcRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 500 when the registered handler is not wrapped with action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/not-wrapped"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      // @ts-expect-error - not a wrapped function
      fn: async (_a: unknown) => "legacy",
    })
    const req = makeRpcRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("dispatches RPC actions with null JSON body and returns result", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/get-dispatch"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      greet: action(async () => "hello"),
    })
    const req = makeRpcRequest(`${routeId}:greet`, token)
    const res = await handler(req)
    await expectJsonBody(res, "hello")
  })

  it("dispatches RPC actions with JSON input", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/dispatch"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      greet: action(async ({ request }) => `hello ${request.body}`),
    })
    const req = makePostRequest(`${routeId}:greet`, token, "world")
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.strictEqual(
      res?.headers.get("content-type"),
      "application/json; charset=utf-8"
    )
    await expectJsonBody(res, "hello world")
  })

  it("dispatches a single JSON input (e.g. tuple) to the action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/tuple-input"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      add: action(async ({ request }) => {
        const tuple = request.body as readonly [number, number]
        return tuple[0]! + tuple[1]!
      }),
    })
    const req = makePostRequest(`${routeId}:add`, token, [3, 7])
    const res = await handler(req)
    await expectJsonBody(res, 10)
  })

  it("returns 500 when the action throws", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/throws"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      boom: action(async () => {
        throw new Error("intentional error")
      }),
    })
    const req = makeRpcRequest(`${routeId}:boom`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("provides request context after await in async action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const ctx = { ping: "pong" }
    const token = makeKiruContextToken(ctx as Record<string, unknown>, SECRET)
    const routeId = "test/ctx-after-await"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      delayed: action(async ({ context }) => {
        await new Promise<void>((r) => setTimeout(r, 5))
        return (context as { ping?: string }).ping
      }),
    })
    const req = makeRpcRequest(`${routeId}:delayed`, token)
    const res = await handler(req)
    await expectJsonBody(res, "pong")
  })

  it("injects request context as the first action callback argument", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const ctx = { user: { name: "Eve" }, role: "editor" }
    const token = makeKiruContextToken(ctx, SECRET)
    const routeId = "test/get-context"
    let captured: unknown = null
    let capturedCtx: unknown = null
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      whoami: action(async (args) => {
        captured = args
        capturedCtx = getActionExecutionContext()
        return "done"
      }),
    })
    const req = makeRpcRequest(`${routeId}:whoami`, token)
    await handler(req)
    assert.ok(captured && typeof captured === "object")
    const handlerArgs = captured as {
      request: {
        body: undefined
        query: undefined
        headers: Record<string, string>
      }
      response: {
        headers: Headers
      }
      context: typeof ctx
      signal: AbortSignal
    }
    assert.deepStrictEqual(handlerArgs.context, ctx)
    assert.strictEqual(handlerArgs.signal, req.signal)
    assert.strictEqual(typeof handlerArgs.request.headers, "object")
    assert.ok(handlerArgs.response.headers instanceof Headers)
    assert.ok(capturedCtx)
  })

  it("returns 499 when the request aborts during a slow action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/abort"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      slow: action(async ({ signal }) => {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, 500)
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(t)
              reject(new DOMException("Aborted", "AbortError"))
            },
            { once: true }
          )
        })
        return "done"
      }),
    })
    const ctrl = new AbortController()
    const req = makeRpcRequest(`${routeId}:slow`, token, {
      signal: ctrl.signal,
    })
    const invoke = handler(req)
    await new Promise((r) => setTimeout(r, 10))
    ctrl.abort()
    const res = await invoke
    assert.strictEqual(res?.status, 499)
  })

  it("validates action body via Schema.safeParse", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/schema-guard"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      greet: action({
        validation: {
          body: {
            safeParse: (body: unknown) => {
              const ok =
                !!body &&
                typeof body === "object" &&
                "name" in body &&
                typeof (body as { name?: unknown }).name === "string"
              return ok
                ? { success: true as const, data: body as { name: string } }
                : { success: false as const, error: null }
            },
          },
        },
        handler: async ({ request }) =>
          `hello ${(request.body as { name: string }).name}`,
      }),
    })
    const req = makePostRequest(`${routeId}:greet`, token, { wrong: true })
    const res = await handler(req)
    assert.strictEqual(res?.status, 400)
    assert.strictEqual(await res?.text(), "")
  })

  it("validates RPC action query", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/query-get"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      search: action({
        validation: {
          query: {
            parse: (q: unknown) => {
              if (
                typeof q !== "object" ||
                q === null ||
                !("q" in q) ||
                typeof (q as { q?: unknown }).q !== "string"
              ) {
                throw new Error("bad query")
              }
              return (q as { q: string }).q
            },
          },
        },
        handler: async ({ request }) => ({ q: request.query }),
      }),
    })
    const ok = await handler(
      makeRpcRequest(`${routeId}:search`, token, {}, { q: "kiru" })
    )
    assert.strictEqual(ok?.status, 200)
    assert.deepStrictEqual(await ok?.json(), { q: "kiru" })

    const bad = await handler(makeRpcRequest(`${routeId}:search`, token))
    assert.strictEqual(bad?.status, 400)
    assert.strictEqual(await bad?.text(), "")
  })

  it("runs middleware before handler and maps RemoteError to HTTP status", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/mw-auth"
    const requireAuth = ({ context }: { context: { user?: unknown } }) => {
      if (!context.user) {
        throw new RemoteError("Unauthorized", "UNAUTHORIZED", { status: 401 })
      }
    }
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      secret: action({
        middleware: [requireAuth],
        handler: async () => "ok",
      }),
    })
    const denied = await handler(makeRpcRequest(`${routeId}:secret`, token))
    assert.strictEqual(denied?.status, 401)
    assert.strictEqual(await denied?.text(), "")

    const allowed = await handler(
      makeRpcRequest(
        `${routeId}:secret`,
        makeKiruContextToken({ user: { id: "1" } }, SECRET)
      )
    )
    assert.strictEqual(allowed?.status, 200)
    assert.strictEqual(await allowed?.json(), "ok")
  })

  it("nested action call via callable shares active RPC context", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const ctx = { user: { id: "u1", name: "Ada" } }
    const token = makeKiruContextToken(ctx, SECRET)
    const routeId = "test/composition"

    const getUser = action(async ({ context }) => {
      return (context as { user?: { id: string; name: string } }).user
    })
    getUser.__kiruActionId = `${routeId}:getUser`

    const updateUser = action(async () => {
      const user = await getUser()
      return { updated: user?.name ?? "unknown" }
    })
    updateUser.__kiruActionId = `${routeId}:updateUser`

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      getUser,
      updateUser,
    })

    const req = makePostRequest(`${routeId}:updateUser`, token, null)
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), { updated: "Ada" })
  })

  it("concurrent RPC handlers do not leak action context", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/concurrent-ctx"

    const readLabel = action(async ({ context }) => {
      await new Promise<void>((r) => setTimeout(r, 20))
      return (context as { label?: string }).label ?? "missing"
    })

    __INTERNAL_REMOTE_REGISTRY.register(routeId, { readLabel })

    const [a, b] = await Promise.all([
      handler(
        makeRpcRequest(
          `${routeId}:readLabel`,
          makeKiruContextToken({ label: "A" }, SECRET)
        )
      ),
      handler(
        makeRpcRequest(
          `${routeId}:readLabel`,
          makeKiruContextToken({ label: "B" }, SECRET)
        )
      ),
    ])

    await expectJsonBody(a, "A")
    await expectJsonBody(b, "B")
  })

  it("nested frames form a linked stack with endedAt on pop", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/frame-stack"

    const inner = action(async () => {
      const ex = getActionExecutionContext()!
      const frame = ex.execution.currentFrame
      return {
        actionId: frame.actionId,
        parentId: frame.parent?.actionId,
      }
    })
    inner.__kiruActionId = `${routeId}:inner`

    const outer = action(async () => {
      const innerFrame = await inner()
      return { innerFrame }
    })
    outer.__kiruActionId = `${routeId}:outer`

    __INTERNAL_REMOTE_REGISTRY.register(routeId, { inner, outer })

    const req = makePostRequest(`${routeId}:outer`, token, null)
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    const body = (await res?.json()) as {
      innerFrame: { actionId: string; parentId?: string }
    }
    assert.strictEqual(body.innerFrame.actionId, `${routeId}:inner`)
    assert.strictEqual(body.innerFrame.parentId, `${routeId}:outer`)
  })

  it("RPC action accepts JSON body and returns result", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/delete-verb"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      remove: action(async ({ request }) => ({ removed: request.body })),
    })
    const req = makePostRequest(`${routeId}:remove`, token, "item-1")
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), { removed: "item-1" })
  })

  it("JSON POST redirect returns redirect JSON and Set-Cookie", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/json-redirect"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: action(async () =>
        redirect(303, "/done", {
          cookies: [{ name: "s", value: "v", path: "/" }],
        })
      ),
    })
    const req = makePostRequest(`${routeId}:go`, token, null)
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    const body = (await res?.json()) as {
      __kiruRedirect: boolean
      location: string
      status: number
    }
    assert.strictEqual(body.__kiruRedirect, true)
    assert.strictEqual(body.location, "/done")
    const cookies = res!.headers.getSetCookie?.() ?? [res!.headers.get("set-cookie")!]
    assert.ok(cookies.some((c) => c.includes("s=v")))
  })

  it("JSON POST mutates context and sets x-kiru-token", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/json-action-result"
    const fresh = { role: "admin" }
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: action(async ({ context }) => {
        Object.assign(context, fresh)
        return { ok: 1 }
      }),
    })
    const req = makePostRequest(`${routeId}:go`, token, null)
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), { ok: 1 })
    const newToken = res!.headers.get(KIRU_TOKEN_RESPONSE_HEADER)
    assert.ok(newToken)
    assert.deepStrictEqual(unwrapKiruToken(newToken!, SECRET), fresh)
  })

  it("__kiruRegister overwrites an existing registration for the same route", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/overwrite"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async () => "first"),
    })
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async () => "second"),
    })
    const req = makeRpcRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    await expectJsonBody(res, "second")
  })

  it("returns 413 when JSON body exceeds maxJsonBodyBytes", async () => {
    const routeId = "test/action-big-body"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async () => "ok"),
    })
    const handler = createRemoteActionHandler(SECRET, {
      requestLimits: { maxJsonBodyBytes: 64 },
    })
    const token = validToken()
    const req = new Request(`http://localhost/?action=${routeId}:fn`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiru-token": token,
      },
      body: JSON.stringify({ data: "x".repeat(200) }),
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 413)
  })

  it("returns 400 when action URL query exceeds limits", async () => {
    const routeId = "test/action-big-query"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action(async () => "ok"),
    })
    const handler = createRemoteActionHandler(SECRET, {
      requestLimits: { maxSearchLength: 32 },
    })
    const token = validToken()
    const qs = "q=" + "a".repeat(64)
    const req = new Request(
      `http://localhost/?action=${routeId}:fn&${qs}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiru-token": token,
        },
        body: "null",
      }
    )
    const res = await handler(req)
    assert.strictEqual(res?.status, 400)
  })
})
