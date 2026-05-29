import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import {
  __clearPrefetchFlightsForTests,
  __setPrefetchFlightForTests,
  awaitInFlightPrefetch,
  cancelInFlightPrefetch,
  resolveLinkPrefetch,
} from "../../router/prefetchRoute.js"

describe("resolveLinkPrefetch", () => {
  it("returns false when prefetch is disabled", () => {
    assert.equal(resolveLinkPrefetch(false), false)
  })

  it("merges defaults for object prefetch", () => {
    const resolved = resolveLinkPrefetch({ trigger: "visible" })
    assert.notEqual(resolved, false)
    if (resolved !== false) {
      assert.equal(resolved.trigger, "visible")
      assert.equal(resolved.chunks, true)
    }
  })
})

describe("awaitInFlightPrefetch", () => {
  afterEach(() => {
    __clearPrefetchFlightsForTests()
  })

  it("waits for an in-flight prefetch before navigation continues", async () => {
    let prefetchDone = false
    const prefetchPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        prefetchDone = true
        resolve()
      }, 20)
    })
    __setPrefetchFlightForTests("/loaders/server", prefetchPromise)

    const joined = awaitInFlightPrefetch("/loaders/server")
    await joined
    assert.equal(prefetchDone, true)
  })

  it("is a no-op when no prefetch is in flight", async () => {
    await awaitInFlightPrefetch("/missing")
  })

  it("cancelInFlightPrefetch aborts in-flight work", async () => {
    const abort = __setPrefetchFlightForTests(
      "/loaders/server",
      new Promise(() => {})
    )
    cancelInFlightPrefetch("/loaders/server")
    assert.equal(abort.signal.aborted, true)
    await awaitInFlightPrefetch("/loaders/server")
  })
})
