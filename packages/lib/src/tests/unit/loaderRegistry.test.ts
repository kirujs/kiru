import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { __INTERNAL_LOADER_REGISTRY, createLoaderHandler } from "../../router/loaderRegistry.js"
import { serverLoader } from "../../router/loaders.js"
import { makeKiruContextToken } from "../../remote/token.js"

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
    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      makeLoaderRequest("r_missing:load", token, loaderBody)
    )
    assert.strictEqual(res?.status, 500)
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

  it("returns 413 when JSON body exceeds maxJsonBodyBytes", async () => {
    const routeId = "test/loader-big-body"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => ({ ok: true })),
    })
    const handler = createLoaderHandler(SECRET, {
      requestLimits: { maxJsonBodyBytes: 64 },
    })
    const token = makeKiruContextToken({}, SECRET)
    const big = JSON.stringify({ ...loaderBody, extra: "x".repeat(200) })
    const req = new Request(
      `http://localhost/?loader=${encodeURIComponent(`${routeId}:load`)}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiru-token": token,
        },
        body: big,
      }
    )
    const res = await handler(req)
    assert.strictEqual(res?.status, 413)
  })

  it("returns 400 when loader RPC body has unexpected top-level keys", async () => {
    const routeId = "test/loader-bad-shape"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => ({ ok: true })),
    })
    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      makeLoaderRequest(`${routeId}:load`, token, {
        ...loaderBody,
        giantPayload: "nope",
      })
    )
    assert.strictEqual(res?.status, 400)
  })

  it("returns 400 when token exceeds maxTokenLength", async () => {
    const routeId = "test/loader-big-token"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => ({ ok: true })),
    })
    const handler = createLoaderHandler(SECRET, {
      requestLimits: { maxTokenLength: 32 },
    })
    const token = "x".repeat(64)
    const res = await handler(
      makeLoaderRequest(`${routeId}:load`, token, loaderBody)
    )
    assert.strictEqual(res?.status, 400)
  })
})
