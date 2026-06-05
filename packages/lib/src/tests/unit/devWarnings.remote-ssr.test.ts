import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import { RemoteDispatchError } from "../../remote/errors.js"
import { __kiruEnsureRemoteDispatch } from "../../ssr/routerHydrate.js"
import { resetKiruRouterRuntimeForTests } from "../../kiruRuntime.js"
import { withJSDOM } from "./jsdom.js"

describe("remote action on ssr bundle", () => {
  const prevFetch = globalThis.fetch

  afterEach(() => {
    resetKiruRouterRuntimeForTests()
    globalThis.fetch = prevFetch
  })

  it("allows dispatch when not pure-client", async () => {
    await withJSDOM(async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ count: 1 }), { status: 200 })
      const data = await __kiruEnsureRemoteDispatch()("test:action")
      assert.deepStrictEqual(data, { count: 1 })
    })
  })

  it("throws RemoteDispatchError on non-2xx", async () => {
    await withJSDOM(async () => {
      globalThis.fetch = async () => new Response(null, { status: 401 })
      await assert.rejects(
        () => __kiruEnsureRemoteDispatch()("test:action"),
        (e: unknown) => e instanceof RemoteDispatchError && e.status === 401
      )
    })
  })

  it("POSTs mutation RPC with framework headers only", async () => {
    await withJSDOM(async () => {
      let capturedHeaders: HeadersInit | undefined
      globalThis.fetch = async (_input, init) => {
        capturedHeaders = init?.headers
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      const data = await __kiruEnsureRemoteDispatch()("test:action", [])
      assert.deepStrictEqual(data, { ok: true })
      const headers = new Headers(capturedHeaders)
      assert.equal(headers.get("content-type"), "application/json")
      assert.ok(headers.has("x-kiru-token"))
    })
  })
})
