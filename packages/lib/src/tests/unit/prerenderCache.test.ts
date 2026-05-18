import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isPrerenderEntryFresh,
  isPrerenderEntryStale,
  memoryPrerenderCache,
} from "../../router/prerenderCache.js"

describe("prerenderCache", () => {
  it("memory store get/set/delete", async () => {
    const store = memoryPrerenderCache()
    await store.set("/a", {
      html: "<html></html>",
      pathname: "/a",
      generatedAt: Date.now(),
      revalidate: 60,
      tags: ["t1"],
    })
    assert.ok(store.get("/a"))
    await store.delete("/a")
    assert.equal(store.get("/a"), null)
  })

  it("deleteByTag", async () => {
    const store = memoryPrerenderCache()
    await store.set("/a", {
      html: "a",
      pathname: "/a",
      generatedAt: Date.now(),
      revalidate: false,
      tags: ["blog"],
    })
    await store.deleteByTag("blog")
    assert.equal(store.get("/a"), null)
  })

  it("fresh vs stale", () => {
    const fresh = {
      html: "x",
      pathname: "/",
      generatedAt: Date.now(),
      revalidate: 60,
      tags: [],
    }
    assert.equal(isPrerenderEntryFresh(fresh), true)
    assert.equal(isPrerenderEntryStale(fresh), false)

    const stale = {
      ...fresh,
      generatedAt: Date.now() - 120_000,
    }
    assert.equal(isPrerenderEntryFresh(stale), false)
    assert.equal(isPrerenderEntryStale(stale), true)
  })
})
