import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { action, __INTERNAL_REMOTE_REGISTRY, createRemoteActionHandler } from "../../remote/index.js"
import { RemoteError } from "../../remote/errors.js"
import { makeKiruContextToken } from "../../remote/token.js"

const SECRET = "test-secret-action-mw"

function makeRpcRequest(
  actionId: string,
  token: string,
  body: unknown = null,
  headers?: Record<string, string>,
  signal?: AbortSignal
): Request {
  return new Request(`http://localhost/?action=${actionId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kiru-token": token,
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
    signal,
  })
}

describe("remote action middleware", () => {
  it("runs middleware chain before handler in order", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = makeKiruContextToken({ user: { id: "u1" } }, SECRET)
    const routeId = "test/mw-order"
    const order: string[] = []

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      sample: action({
        middleware: [
          () => {
            order.push("mw1")
          },
          () => {
            order.push("mw2")
          },
        ],
        handler: async () => {
          order.push("handler")
          return "ok"
        },
      }),
    })

    const res = await handler(makeRpcRequest(`${routeId}:sample`, token))
    assert.equal(res?.status, 200)
    assert.deepEqual(order, ["mw1", "mw2", "handler"])
  })

  it("short-circuits when middleware throws RemoteError", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const routeId = "test/mw-short-circuit"
    let reachedHandler = false

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      guarded: action({
        middleware: [
          () => {
            throw new RemoteError("Unauthorized", "UNAUTHORIZED", { status: 401 })
          },
        ],
        handler: async () => {
          reachedHandler = true
          return "ok"
        },
      }),
    })

    const res = await handler(makeRpcRequest(`${routeId}:guarded`, token))
    assert.equal(res?.status, 401)
    assert.equal(await res?.text(), "")
    assert.equal(reachedHandler, false)
  })

  it("receives request headers and signal in middleware", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const routeId = "test/mw-headers-signal"
    const ctrl = new AbortController()
    let seenHeader = ""
    let middlewareSignal: AbortSignal | null = null

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      inspect: action({
        middleware: [
          ({ request, signal }) => {
            seenHeader = request.headers["x-test"] ?? ""
            middlewareSignal = signal
          },
        ],
        handler: async ({ request }) => ({ seen: request.headers["x-test"] ?? "" }),
      }),
    })

    const res = await handler(
      makeRpcRequest(
        `${routeId}:inspect`,
        token,
        null,
        { "x-test": "secret" },
        ctrl.signal
      )
    )
    assert.equal(res?.status, 200)
    assert.equal(seenHeader, "secret")
    assert.notEqual(middlewareSignal, null)
    assert.deepEqual(await res?.json(), { seen: "secret" })
  })

  it("sees raw body before validation rejects invalid payload", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const routeId = "test/mw-pre-validation"
    let middlewareBody: unknown = null
    let reachedHandler = false

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      check: action({
        middleware: [
          ({ request }) => {
            middlewareBody = request.body
          },
        ],
        validation: {
          body: {
            parse: (input: unknown) => {
              if (
                typeof input !== "object" ||
                input === null ||
                typeof (input as { name?: unknown }).name !== "string"
              ) {
                throw new Error("invalid")
              }
              return input as { name: string }
            },
          },
        },
        handler: async () => {
          reachedHandler = true
          return "ok"
        },
      }),
    })

    const res = await handler(
      makeRpcRequest(`${routeId}:check`, token, { wrong: true })
    )
    assert.equal(res?.status, 400)
    assert.deepEqual(middlewareBody, { wrong: true })
    assert.equal(reachedHandler, false)
  })
})
