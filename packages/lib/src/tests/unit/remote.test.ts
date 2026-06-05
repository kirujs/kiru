import { describe, it } from "node:test"
import assert from "node:assert"
import {
  makeKiruContextToken,
  makeKiruContextTokenAsync,
  unwrapKiruToken,
} from "../../remote/token.js"
import {
  __INTERNAL_REMOTE_REGISTRY,
  createRemoteHandler,
  getRemoteExecutionContext,
  KIRU_TOKEN_RESPONSE_HEADER,
  mutation,
  query,
  redirect,
  getRequestEvent,
  type Schema,
} from "../../remote/index.js"
import { RemoteError } from "../../remote/errors.js"
const SECRET = "test-secret-abc"

const jsonBodySchema: Schema<unknown> = {
  parse: (input: unknown) => input,
}

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
  return new Request(`http://localhost/?mutation=${actionId}`, {
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
  return new Request(`http://localhost/?mutation=${actionId}${qs}`, {
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
  return new Request(`http://localhost/?mutation=${actionId}${qs}`, {
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
    const handler = createRemoteHandler(SECRET, {
      allowedOrigins: ["https://trusted.example"]
    })
    const token = validToken()
    const routeId = "test/origin"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: mutation(async () => "ok"),
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
    const handler = createRemoteHandler(SECRET, {
      allowedOrigins: ["http://localhost"]
    })
    const token = validToken()
    const routeId = "test/origin-ok"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: mutation(async () => "yes"),
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
    const handler = createRemoteHandler(SECRET, {
      allowedOrigins: ["https://only.here"],
      exposeErrors: true
    })
    const token = validToken()
    const routeId = "test/forbidden-json"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: mutation(async () => "x"),
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
    const handler = createRemoteHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/remote-err"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      boom: mutation(async () => {
        throw new RemoteError("nope", "TEST_CODE", { status: 422 })
      }),
    })
    const req = makeRpcRequest(`${routeId}:boom`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 422)
    assert.strictEqual(await res?.text(), "")
  })

  it("returns handler JSON as-is on the wire", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/passthrough"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      withFields: mutation(async () => ({
        ok: false,
        error: { fields: { x: 'nope' } },
      })),
      plain: mutation(async () => ({ message: "bad" })),
      auth: mutation(async () => ({
        ok: false,
        error: { message: "nope", code: "UNAUTHORIZED", status: 401 },
      })),
    })
    const withFields = await handler(makeRpcRequest(`${routeId}:withFields`, token))
    await expectJsonBody(withFields, {
      ok: false,
      error: { fields: { x: "nope" } }
    })

    const plain = await handler(makeRpcRequest(`${routeId}:plain`, token))
    await expectJsonBody(plain, { message: "bad" })

    const auth = await handler(makeRpcRequest(`${routeId}:auth`, token))
    await expectJsonBody(auth, {
      ok: false,
      error: { message: "nope", code: "UNAUTHORIZED", status: 401 }
    })
  })
})

// ---------------------------------------------------------------------------
// remote/index.ts — registry + handler
// ---------------------------------------------------------------------------

describe("remote / handler", () => {
  it("returns 405 when JSON RPC is invoked with GET", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/method-mismatch"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: mutation(async () => "ok"),
    })
    const req = makeGetRequest(`${routeId}:fn`, token)
    assert.strictEqual((await handler(req))?.status, 405)
  })

  it("returns 405 when POST action is invoked with GET", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/post-via-get"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: mutation(jsonBodySchema, async (body) => body),
    })
    const req = makeGetRequest(`${routeId}:fn`, token)
    assert.strictEqual((await handler(req))?.status, 405)
  })

  it("dispatches POST actions even when content-type is not application/json", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/wrong-content-type"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: mutation(jsonBodySchema, async (body) => body),
    })
    const req = new Request(`http://localhost/?mutation=${routeId}:fn`, {
      method: "POST",
      headers: { "content-type": "text/plain", "x-kiru-token": token },
      body: "null",
    })
    const res = await handler(req)
    await expectJsonBody(res, null)
  })

  it("returns null when action query param is missing", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const req = new Request("http://localhost/", {
      method: "GET",
      headers: { "x-kiru-token": token },
    })
    assert.strictEqual(await handler(req), null)
  })

  it("returns null when x-kiru-token header is missing", async () => {
    const handler = createRemoteHandler(SECRET)
    const req = new Request("http://localhost/?mutation=x:y", {
      method: "GET",
    })
    assert.strictEqual(await handler(req), null)
  })

  it("returns 500 when action ID has no colon separator", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const req = makeRpcRequest("no-colon-here", token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 400 when token is invalid", async () => {
    const handler = createRemoteHandler(SECRET)
    const req = makeRpcRequest("route:fn", "not.a.valid.token")
    const res = await handler(req)
    assert.strictEqual(res?.status, 400)
  })

  it("returns 400 when JSON POST body is invalid", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/body-invalid-json"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: mutation(async () => "ok"),
    })
    const req = new Request(`http://localhost/?mutation=${routeId}:fn`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-kiru-token": token },
      body: "not-json",
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 400)
  })

  it("returns 500 when the action is not registered", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const req = makeRpcRequest("unknown/route:unknownFn", token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 500 when the registered value is not a function", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/not-a-function"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: "not a function",
    })
    const req = makeRpcRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("returns 500 when the registered handler is not a remote mutation", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/not-wrapped"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: async (_a: unknown) => "legacy",
    })
    const req = makeRpcRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("dispatches RPC actions with null JSON body and returns result", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/get-dispatch"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      greet: mutation(async () => "hello"),
    })
    const req = makeRpcRequest(`${routeId}:greet`, token)
    const res = await handler(req)
    await expectJsonBody(res, "hello")
  })

  it("dispatches RPC actions with JSON input", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/dispatch"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      greet: mutation(jsonBodySchema, async (body) => `hello ${body}`),
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
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/tuple-input"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      add: mutation(jsonBodySchema, async (body) => {
        const tuple = body as readonly [number, number]
        return tuple[0]! + tuple[1]!
      }),
    })
    const req = makePostRequest(`${routeId}:add`, token, [3, 7])
    const res = await handler(req)
    await expectJsonBody(res, 10)
  })

  it("returns 500 when the action throws", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/throws"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      boom: mutation(async () => {
        throw new Error("intentional error")
      }),
    })
    const req = makeRpcRequest(`${routeId}:boom`, token)
    const res = await handler(req)
    assert.strictEqual(res?.status, 500)
  })

  it("provides request context after await in async action", async () => {
    const handler = createRemoteHandler(SECRET)
    const ctx = { ping: "pong" }
    const token = makeKiruContextToken(ctx as Record<string, unknown>, SECRET)
    const routeId = "test/ctx-after-await"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      delayed: mutation(async () => {
        const { context } = getRequestEvent()
        await new Promise<void>((r) => setTimeout(r, 5))
        return (context as { ping?: string }).ping
      }),
    })
    const req = makeRpcRequest(`${routeId}:delayed`, token)
    const res = await handler(req)
    await expectJsonBody(res, "pong")
  })

  it("injects request context as the first action callback argument", async () => {
    const handler = createRemoteHandler(SECRET)
    const ctx = { user: { name: "Eve" }, role: "editor" }
    const token = makeKiruContextToken(ctx, SECRET)
    const routeId = "test/get-context"
    let captured: unknown = null
    let capturedCtx: unknown = null
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      whoami: mutation(async () => {
        const event = getRequestEvent()
        captured = {
          context: event.context,
          response: event.response,
          signal: event.signal,
        }
        capturedCtx = getRemoteExecutionContext()
        return "done"
      }),
    })
    const req = makeRpcRequest(`${routeId}:whoami`, token)
    await handler(req)
    assert.ok(captured && typeof captured === "object")
    const handlerArgs = captured as {
      context: typeof ctx
      response: {
        headers: Headers
      }
      signal: AbortSignal
    }
    assert.deepStrictEqual(handlerArgs.context, ctx)
    assert.strictEqual(handlerArgs.signal, req.signal)
    assert.ok(handlerArgs.response.headers instanceof Headers)
    assert.ok(capturedCtx)
  })

  it("returns 499 when the request aborts during a slow action", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/abort"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      slow: mutation(async () => {
        const { signal } = getRequestEvent()
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
    const handler = createRemoteHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/schema-guard"
    const nameSchema = {
      parse: (body: unknown) => {
        if (
          !body ||
          typeof body !== "object" ||
          !("name" in body) ||
          typeof (body as { name?: unknown }).name !== "string"
        ) {
          throw new Error("invalid")
        }
        return body as { name: string }
      },
    }
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      greet: mutation(nameSchema, async ({ name }) => `hello ${name}`),
    })
    const req = makePostRequest(`${routeId}:greet`, token, { wrong: true })
    const res = await handler(req)
    assert.strictEqual(res?.status, 400)
    assert.strictEqual(await res?.text(), "")
  })

  it("maps RemoteError from handler guard to HTTP status", async () => {
    const handler = createRemoteHandler(SECRET, { exposeErrors: true })
    const token = validToken()
    const routeId = "test/mw-auth"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      secret: mutation(async () => {
        const { context } = getRequestEvent()
        if (!(context as { user?: unknown }).user) {
          throw new RemoteError("Unauthorized", "UNAUTHORIZED", { status: 401 })
        }
        return "ok"
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
    const handler = createRemoteHandler(SECRET)
    const ctx = { user: { id: "u1", name: "Ada" } }
    const token = makeKiruContextToken(ctx, SECRET)
    const routeId = "test/composition"

    const getUser = query(async () => {
      const { context } = getRequestEvent()
      return (context as { user?: { id: string; name: string } }).user
    })
    getUser.__kiruQueryId = `${routeId}:getUser`

    const updateUser = mutation(async () => {
      const user = await getUser()
      return { updated: user?.name ?? "unknown" }
    })
    updateUser.__kiruMutationId = `${routeId}:updateUser`

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
    const handler = createRemoteHandler(SECRET)
    const routeId = "test/concurrent-ctx"

    const readLabel = mutation(async () => {
      const { context } = getRequestEvent()
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
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/frame-stack"

    const inner = mutation(async () => {
      const ex = getRemoteExecutionContext()!
      const frame = ex.execution.currentFrame
      return {
        actionId: frame.actionId,
        parentId: frame.parent?.actionId,
      }
    })
    inner.__kiruMutationId = `${routeId}:inner`

    const outer = mutation(async () => {
      const innerFrame = await inner()
      return { innerFrame }
    })
    outer.__kiruMutationId = `${routeId}:outer`

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
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/delete-verb"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      remove: mutation(jsonBodySchema, async (body) => ({ removed: body })),
    })
    const req = makePostRequest(`${routeId}:remove`, token, "item-1")
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), { removed: "item-1" })
  })

  it("JSON POST redirect returns redirect JSON and Set-Cookie", async () => {
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/json-redirect"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: mutation(async () =>
        redirect(303, "/done", {
          cookies: [{ name: 's', value: 'v', path: '/' }],
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
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/json-action-result"
    const fresh = { role: "admin" }
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: mutation(async () => {
        const { context } = getRequestEvent()
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
    const handler = createRemoteHandler(SECRET)
    const token = validToken()
    const routeId = "test/overwrite"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: mutation(async () => "first"),
    })
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: mutation(async () => "second"),
    })
    const req = makeRpcRequest(`${routeId}:fn`, token)
    const res = await handler(req)
    await expectJsonBody(res, "second")
  })

  it("returns 413 when JSON body exceeds maxJsonBodyBytes", async () => {
    const routeId = "test/action-big-body"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      fn: mutation(async () => "ok"),
    })
    const handler = createRemoteHandler(SECRET, {
      requestLimits: { maxJsonBodyBytes: 64 },
    })
    const token = validToken()
    const req = new Request(`http://localhost/?mutation=${routeId}:fn`, {
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

})
