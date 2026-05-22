import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
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
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      await assert.doesNotReject(() =>
        __kiruEnsureRemoteDispatch()("test:action", "POST")
      )
    })
  })
})
