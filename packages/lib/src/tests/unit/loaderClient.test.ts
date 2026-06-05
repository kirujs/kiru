import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  __INTERNAL_LOADER_REGISTRY,
  createLoaderHandler,
} from "../../router/loaderRegistry.js"
import { serializeLoaderRpcContext } from "../../router/loaderRpc.js"
import { serverLoader } from "../../router/loaders.js"
import { makeKiruContextToken } from "../../remote/token.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"
import type { LoaderContext } from "../../router/loaders.js"

const SECRET = "test-loader-client-secret"

function fullLoaderContext(routeId: string): LoaderContext {
  return {
    params: {},
    url: { pathname: "/", search: "", hash: "" },
    query: {},
    context: {},
    meta: {},
    route: { id: routeId },
    request: undefined,
    signal: staticLoaderSignal(),
  }
}

describe("loaderClient RPC body", () => {
  it("serializeLoaderRpcContext omits signal and request", () => {
    const ctx = fullLoaderContext("r_test")
    const body = serializeLoaderRpcContext(ctx)
    assert.deepEqual(Object.keys(body).sort(), [
      "context",
      "meta",
      "params",
      "query",
      "route",
      "url",
    ])
    assert.equal("signal" in body, false)
    assert.equal("request" in body, false)
  })

  it("createLoaderHandler accepts serialized context from buildLoaderContext shape", async () => {
    const routeId = "test/loader-client-roundtrip"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => ({ ok: true })),
    })
    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const body = serializeLoaderRpcContext(fullLoaderContext(routeId))
    const res = await handler(
      new Request(
        `http://localhost/?loader=${encodeURIComponent(`${routeId}:load`)}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-kiru-token": token,
          },
          body: JSON.stringify(body),
        }
      )
    )
    assert.equal(res?.status, 200)
    assert.deepEqual(await res?.json(), { ok: true })
  })

  it("createLoaderHandler returns 400 when raw LoaderContext includes signal", async () => {
    const routeId = "test/loader-client-signal"
    __INTERNAL_LOADER_REGISTRY.register(routeId, {
      load: serverLoader(async () => ({ ok: true })),
    })
    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      new Request(
        `http://localhost/?loader=${encodeURIComponent(`${routeId}:load`)}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-kiru-token": token,
          },
          body: JSON.stringify(fullLoaderContext(routeId)),
        }
      )
    )
    assert.equal(res?.status, 400)
  })
})
