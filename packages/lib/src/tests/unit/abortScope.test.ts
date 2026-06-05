import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  remoteCallContext,
  resolveRemoteFetchSignal,
  runWithRemoteAbortSignal,
} from "../../remote/abortScope.js"

describe("abortScope", () => {
  it("exposes bag only inside runWithRemoteAbortSignal", () => {
    const ac = new AbortController()
    assert.equal(remoteCallContext.abortSignal, undefined)
    runWithRemoteAbortSignal(ac.signal, () => {
      assert.equal(remoteCallContext.abortSignal, ac.signal)
    })
    assert.equal(remoteCallContext.abortSignal, undefined)
  })

  it("resolveRemoteFetchSignal combines bag and explicit", () => {
    const bag = new AbortController()
    const explicit = new AbortController()
    runWithRemoteAbortSignal(bag.signal, () => {
      const merged = resolveRemoteFetchSignal(explicit.signal)
      assert.ok(merged)
      bag.abort()
      assert.equal(merged!.aborted, true)
    })
  })
})
