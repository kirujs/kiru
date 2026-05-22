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
  actionResult,
  createRemoteActionHandler,
  getActionExecutionContext,
  KIRU_TOKEN_RESPONSE_HEADER,
  redirect,
  fail,
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
      fn: action.get(async () => "ok"),
    })
    const req = makeGetRequest(`${routeId}:fn`, token, {
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
      fn: action.get(async () => "yes"),
    })
    const req = makeGetRequest(`${routeId}:fn`, token, {
      headers: {
        "x-kiru-token": token,
        origin: "http://localhost",
      },
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
      fn: action.get(async () => "x"),
    })
    const req = makeGetRequest(`${routeId}:fn`, token, {
      headers: {
        "x-kiru-token": token,
        origin: "http://localhost",
      },
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 403)
    const j = (await res?.json()) as { error: { code: string } }
    assert.strictEqual(j.error.code, "FORBIDDEN_ORIGIN")
  })

  it("maps internal RemoteError to __kiruFail when exposeErrors is true", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/remote-err"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      boom: action.get(async () => {
        throw new RemoteError("nope", "TEST_CODE", { status: 422 })
      }),
    })
    const req = makeGetRequest(`${routeId}:boom`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 422)
    const j = (await res?.json()) as { __kiruFail: boolean; code?: string; message: string }
    assert.strictEqual(j.__kiruFail, true)
    assert.strictEqual(j.code, "TEST_CODE")
    assert.strictEqual(j.message, "nope")
  })

  it("returns fail() wire with status defaults", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/fail-defaults"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      withFields: action.get(async () =>
        fail({ message: "bad", fields: { x: "nope" } })
      ),
      noFields: action.get(async () => fail({ message: "bad" })),
      auth: action.get(async () =>
        fail({ message: "nope", status: 401, code: "UNAUTHORIZED" })
      ),
    })
    const withFields = await handler(makeGetRequest(`${routeId}:withFields`, token))
    assert.strictEqual(withFields?.status, 422)
    const wf = (await withFields?.json()) as {
      __kiruFail: boolean
      fields?: Record<string, string>
    }
    assert.strictEqual(wf.__kiruFail, true)
    assert.deepStrictEqual(wf.fields, { x: "nope" })

    const noFields = await handler(makeGetRequest(`${routeId}:noFields`, token))
    assert.strictEqual(noFields?.status, 400)

    const auth = await handler(makeGetRequest(`${routeId}:auth`, token))
    assert.strictEqual(auth?.status, 401)
    const aj = (await auth?.json()) as { code?: string }
    assert.strictEqual(aj.code, "UNAUTHORIZED")
  })
})

// ---------------------------------------------------------------------------
// remote/index.ts — registry + handler
// ---------------------------------------------------------------------------

describe("remote / handler", () => {
  it("returns null when HTTP method does not match the action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/method-mismatch"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action.get(async () => "ok"),
    })
    const req = makePostRequest(`${routeId}:fn`, token)
    assert.strictEqual(await handler(req), null)
  })

  it("returns null when POST action is invoked with GET", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/post-via-get"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action.post(async ({ body }) => body),
    })
    const req = makeGetRequest(`${routeId}:fn`, token)
    assert.strictEqual(await handler(req), null)
  })

  it("returns null when content-type is not application/json for POST actions", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/wrong-content-type"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action.post(async ({ body }) => body),
    })
    const req = new Request(`http://localhost/?action=${routeId}:fn`, {
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
    const req = makeGetRequest("no-colon-here", token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 500 when token is invalid", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const req = makeGetRequest("route:fn", "not.a.valid.token")
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 500 when POST body is not valid JSON", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/body-invalid-json"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action.post(async () => "ok"),
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
    const req = makeGetRequest("unknown/route:unknownFn", token)
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
    const req = makeGetRequest(`${routeId}:fn`, token)
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
    const req = makeGetRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("dispatches GET actions and returns JSON result", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/get-dispatch"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      greet: action.get(async () => "hello"),
    })
    const req = makeGetRequest(`${routeId}:greet`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.strictEqual(await res?.json(), "hello")
  })

  it("dispatches POST actions with JSON input", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/dispatch"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      greet: action.post(async ({ body: name }) => `hello ${name}`),
    })
    const req = makePostRequest(`${routeId}:greet`, token, "world")
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
      add: action.post(async ({ body }) => {
        const tuple = body as readonly [number, number]
        return tuple[0]! + tuple[1]!
      }),
    })
    const req = makePostRequest(`${routeId}:add`, token, [3, 7])
    const res = await handler(req)
    const body = await res?.json()
    assert.strictEqual(body, 10)
  })

  it("returns 500 when the action throws", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/throws"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      boom: action.get(async () => {
        throw new Error("intentional error")
      }),
    })
    const req = makeGetRequest(`${routeId}:boom`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("provides request context after await in async action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const ctx = { ping: "pong" }
    const token = makeKiruContextToken(ctx as Record<string, unknown>, SECRET)
    const routeId = "test/ctx-after-await"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      delayed: action.get(async ({ context }) => {
        await new Promise<void>((r) => setTimeout(r, 5))
        return (context as { ping?: string }).ping
      }),
    })
    const req = makeGetRequest(`${routeId}:delayed`, token)
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
    let capturedCtx: unknown = null
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      whoami: action.get(async (args) => {
        captured = args
        capturedCtx = getActionExecutionContext()
        return "done"
      }),
    })
    const req = makeGetRequest(`${routeId}:whoami`, token)
    await handler(req)
    assert.ok(captured && typeof captured === "object")
    const handlerArgs = captured as {
      body: undefined
      query: undefined
      headers: Record<string, string>
      context: typeof ctx
      signal: AbortSignal
    }
    assert.deepStrictEqual(handlerArgs.context, ctx)
    assert.strictEqual(handlerArgs.signal, req.signal)
    assert.ok(handlerArgs.headers)
    assert.ok(capturedCtx)
  })

  it("returns 499 when the request aborts during a slow action", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/abort"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      slow: action.get(async ({ signal }) => {
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
    const req = makeGetRequest(`${routeId}:slow`, token, {
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
      greet: action.post({
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
        handler: async ({ body }) => `hello ${body.name}`,
      }),
    })
    const req = makePostRequest(`${routeId}:greet`, token, { wrong: true })
    const res = await handler(req)
    assert.strictEqual(res?.status, 400)
    const j = (await res?.json()) as { __kiruFail: boolean; code?: string }
    assert.strictEqual(j.__kiruFail, true)
    assert.strictEqual(j.code, "INVALID_BODY")
  })

  it("validates GET action query", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/query-get"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      search: action.get({
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
        handler: async ({ query }) => ({ q: query }),
      }),
    })
    const ok = await handler(
      makeGetRequest(`${routeId}:search`, token, {}, { q: "kiru" })
    )
    assert.strictEqual(ok?.status, 200)
    assert.deepStrictEqual(await ok?.json(), { q: "kiru" })

    const bad = await handler(makeGetRequest(`${routeId}:search`, token))
    assert.strictEqual(bad?.status, 400)
    const j = (await bad?.json()) as { __kiruFail: boolean; code?: string }
    assert.strictEqual(j.__kiruFail, true)
    assert.strictEqual(j.code, "INVALID_QUERY")
  })

  it("runs middleware before handler and surfaces fail wire from RemoteError", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/mw-auth"
    const requireAuth = ({ context }: { context: { user?: unknown } }) => {
      if (!context.user) {
        throw new RemoteError("Unauthorized", "UNAUTHORIZED", { status: 401 })
      }
    }
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      secret: action.get({
        middleware: [requireAuth],
        handler: async () => "ok",
      }),
    })
    const denied = await handler(makeGetRequest(`${routeId}:secret`, token))
    assert.strictEqual(denied?.status, 401)
    const j = (await denied?.json()) as { __kiruFail: boolean; code?: string }
    assert.strictEqual(j.__kiruFail, true)
    assert.strictEqual(j.code, "UNAUTHORIZED")

    const allowed = await handler(
      makeGetRequest(
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

    const getUser = action.get(async ({ context }) => {
      return (context as { user?: { id: string; name: string } }).user
    })
    getUser.__kiruActionId = `${routeId}:getUser`

    const updateUser = action.post(async () => {
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

    const readLabel = action.get(async ({ context }) => {
      await new Promise<void>((r) => setTimeout(r, 20))
      return (context as { label?: string }).label ?? "missing"
    })

    __INTERNAL_REMOTE_REGISTRY.register(routeId, { readLabel })

    const [a, b] = await Promise.all([
      handler(
        makeGetRequest(
          `${routeId}:readLabel`,
          makeKiruContextToken({ label: "A" }, SECRET)
        )
      ),
      handler(
        makeGetRequest(
          `${routeId}:readLabel`,
          makeKiruContextToken({ label: "B" }, SECRET)
        )
      ),
    ])

    assert.strictEqual(await a?.json(), "A")
    assert.strictEqual(await b?.json(), "B")
  })

  it("nested frames form a linked stack with endedAt on pop", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/frame-stack"

    const inner = action.get(async () => {
      const ex = getActionExecutionContext()!
      const frame = ex.execution.currentFrame
      return {
        actionId: frame.actionId,
        parentId: frame.parent?.actionId,
      }
    })
    inner.__kiruActionId = `${routeId}:inner`

    const outer = action.post(async () => {
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

  it("DELETE action accepts JSON body and returns result", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/delete-verb"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      remove: action.delete(async ({ body: id }) => ({ removed: id })),
    })
    const req = new Request(`http://localhost/?action=${routeId}:remove`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        "x-kiru-token": token,
      },
      body: JSON.stringify("item-1"),
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), { removed: "item-1" })
  })

  it("JSON POST redirect returns redirect JSON and Set-Cookie", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/json-redirect"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: action.post(async () =>
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

  it("JSON POST actionResult unwraps body and sets x-kiru-token", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const routeId = "test/json-action-result"
    const fresh = { role: "admin" }
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: action.post(async () => actionResult({ ok: 1 }, { context: fresh })),
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
      fn: action.get(async () => "first"),
    })
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: action.get(async () => "second"),
    })
    const req = makeGetRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    const body = await res?.json()
    assert.strictEqual(body, "second")
  })
})
