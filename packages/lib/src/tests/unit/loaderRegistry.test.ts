import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { __INTERNAL_LOADER_REGISTRY, createLoaderHandler } from "../../router/loaderRegistry.js"
import { serverLoader } from "../../router/loaders.js"
import { makeKiruContextToken } from "../../remote/token.js"

const SECRET = "test-loader-secret"

function makeLoaderRequest(
  loaderId: string,
  token: string,
  body: Record<string, unknown>
) {
  return new Request(`http://localhost/?loader=${encodeURIComponent(loaderId)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kiru-token": token,
    },
    body: JSON.stringify(body),
  })
}

describe("createLoaderHandler", () => {
  it("returns 500 when the server loader was never registered", async () => {
    const handler = createLoaderHandler(SECRET)
    const token = makeKiruContextToken({}, SECRET)
    const res = await handler(
      makeLoaderRequest("r_missing:load", token, {
        params: {},
        url: { pathname: "/loaders/server", search: "", hash: "" },
        query: {},
        context: {},
      })
    )
    assert.strictEqual(res?.status, 500)
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
      makeLoaderRequest(`${routeId}:load`, token, {
        params: {},
        url: { pathname: "/loaders/server", search: "", hash: "" },
        query: {},
        context: {},
      })
    )
    assert.strictEqual(res?.status, 200)
    const body = await res?.json()
    assert.deepEqual(body, { source: "server", pathname: "/loaders/server" })
  })
})
