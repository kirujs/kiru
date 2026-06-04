import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ActionDispatchError } from "../../remote/errors.js"
import { resetKiruRouterRuntimeForTests } from "../../kiruRuntime.js"
import { __kiruEnsureRemoteDispatch } from "../../ssr/routerHydrate.js"

describe("remote action on csr bundle", () => {
  it("throws when dispatch is unavailable in pure-client dev", async () => {
    ;(globalThis as Record<string, unknown>).window = globalThis
    try {
      await assert.rejects(
        () => __kiruEnsureRemoteDispatch()("test:action"),
        (e: unknown) =>
          e instanceof ActionDispatchError && /Remote `action`/.test(e.message)
      )
    } finally {
      resetKiruRouterRuntimeForTests()
      delete (globalThis as Record<string, unknown>).window
    }
  })
})
