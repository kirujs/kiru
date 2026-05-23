import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import { ActionDispatchError } from "../../remote/errors.js"
import { __kiruEnsureRemoteDispatch } from "../../ssr/routerHydrate.js"
import { withJSDOM } from "./jsdom.js"

describe("remote action on ssr bundle", () => {
  const prevFetch = globalThis.fetch

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__kiru_serverActions
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

  it("throws ActionDispatchError on non-2xx", async () => {
    await withJSDOM(async () => {
      globalThis.fetch = async () => new Response(null, { status: 401 })
      await assert.rejects(
        () => __kiruEnsureRemoteDispatch()("test:action"),
        (e: unknown) => e instanceof ActionDispatchError && e.status === 401
      )
    })
  })
})
