import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { __INTERNAL_LOADER_REGISTRY, createLoaderHandler } from "../../router/loaderRegistry.js"
import { serverLoader } from "../../router/loaders.js"
import { makeKiruContextToken } from "../../remote/token.js"
import {
  __clearRpcTraceForTests,
  __setRpcTraceEnabledForTests,
  dumpRpcTrace,
} from "../../remote/rpcTrace.js"

const SECRET = "test-loader-secret"

function makeLoaderRequest(
  loaderId: string,
  token: string,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>
) {
  return new Request(`http://localhost/?loader=${encodeURIComponent(loaderId)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kiru-token": token,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  })
}

const loaderBody = {
  params: {},
  url: { pathname: "/loaders/server", search: "", hash: "" },
  query: {},
  context: {},
}

describe("createLoaderHandler", () => {
  it("returns 500 when the server loader was never registered", async () => {
    __setRpcTraceEnabledForTests(true)
    __clearRpcTraceForTests()
    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      makeLoaderRequest("r_missing:load", token, loaderBody)
    )
    assert.strictEqual(res?.status, 500)
    const missing = dumpRpcTrace().find((e) => e.phase === "handler_missing")
    assert.ok(missing)
    assert.strictEqual(missing?.meta?.hadLazyImport, false)
    __setRpcTraceEnabledForTests(false)
  })

  it("loads a lazy module on first request via ensure", async () => {
    const routeId = "lazy/loaders-server"
    __INTERNAL_LOADER_REGISTRY.registerLazyImport(routeId, async () => {
      __INTERNAL_LOADER_REGISTRY.register(routeId, {
        load: serverLoader(async (ctx) => ({
          source: "server",
          pathname: ctx.url.pathname,
        })),
      })
    })

    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      makeLoaderRequest(`${routeId}:load`, token, loaderBody)
    )
    assert.strictEqual(res?.status, 200)
  })

  it("returns loader data when the handler is registered", async () => {
    const routeId = "test/loaders-server"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async (ctx) => ({
        source: "server",
        pathname: ctx.url.pathname,
      })),
    })

    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      makeLoaderRequest(`${routeId}:load`, token, loaderBody)
    )
    assert.strictEqual(res?.status, 200)
    const body = await res?.json()
    assert.deepEqual(body, { source: "server", pathname: "/loaders/server" })
  })

  it("returns 400 when x-kiru-token header is missing", async () => {
    const routeId = "test/loader-no-token"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => ({ ok: true })),
    })
    const handler = createLoaderHandler(SECRET)
    const req = new Request(
      `http://localhost/?loader=${encodeURIComponent(`${routeId}:load`)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(loaderBody),
      }
    )
    const res = await handler(req)
    assert.strictEqual(res?.status, 400)
  })

  it("returns 400 when token is signed with wrong secret", async () => {
    const routeId = "test/loader-wrong-secret"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => ({ ok: true })),
    })
    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, "other-secret")
    const res = await handler(
      makeLoaderRequest(`${routeId}:load`, token, loaderBody)
    )
    assert.strictEqual(res?.status, 400)
  })

  it("returns 403 when allowedOrigins is set and Origin mismatches", async () => {
    const routeId = "test/loader-origin"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => ({ ok: true })),
    })
    const handler = createLoaderHandler(SECRET, {
      allowedOrigins: ["https://trusted.example"],
    })
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      makeLoaderRequest(`${routeId}:load`, token, loaderBody, {
        origin: "http://evil.com",
      })
    )
    assert.strictEqual(res?.status, 403)
  })

  it("allows loader when Origin matches allowedOrigins", async () => {
    const routeId = "test/loader-origin-ok"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => ({ data: 1 })),
    })
    const handler = createLoaderHandler(SECRET, {
      allowedOrigins: ["http://localhost"],
    })
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      makeLoaderRequest(`${routeId}:load`, token, loaderBody, {
        origin: "http://localhost",
      })
    )
    assert.strictEqual(res?.status, 200)
  })

  it("emits rpcTrace phases when KIRU_RPC_TRACE=1", async () => {
    __setRpcTraceEnabledForTests(true)
    __clearRpcTraceForTests()
    const routeId = "test/loader-trace"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => ({ traced: true })),
    })
    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      makeLoaderRequest(`${routeId}:load`, token, loaderBody)
    )
    assert.strictEqual(res?.status, 200)
    const phases = dumpRpcTrace().map((e) => e.phase)
    assert.ok(phases.includes("invoke_start"))
    assert.ok(phases.includes("invoke_end"))
    __setRpcTraceEnabledForTests(false)
  })

  it("emits invoke_error when loader throws", async () => {
    __setRpcTraceEnabledForTests(true)
    __clearRpcTraceForTests()
    const routeId = "test/loader-throw"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => {
        throw new Error("loader boom")
      }),
    })
    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      makeLoaderRequest(`${routeId}:load`, token, loaderBody)
    )
    assert.strictEqual(res?.status, 500)
    assert.ok(
      dumpRpcTrace().some((e) => e.phase === "invoke_error" && e.error?.includes("boom"))
    )
    __setRpcTraceEnabledForTests(false)
  })
})
