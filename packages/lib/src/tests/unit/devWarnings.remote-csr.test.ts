import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { __kiruEnsureRemoteDispatch } from "../../ssr/routerHydrate.js"

describe("remote action on csr bundle", () => {
  it("rejects dispatch in dev", async () => {
    ;(globalThis as Record<string, unknown>).window = globalThis
    try {
      await assert.rejects(
        () => __kiruEnsureRemoteDispatch()("test:action", "POST"),
        /Remote `action`/
      )
    } finally {
      delete (globalThis as Record<string, unknown>).__kiru_serverActions
      delete (globalThis as Record<string, unknown>).window
    }
  })
})
