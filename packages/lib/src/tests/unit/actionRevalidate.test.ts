import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { action } from "../../remote/action.js"
import {
  memoryPrerenderCache,
  setGlobalPrerenderCache,
} from "../../router/prerenderCache.js"
import { applyServerRevalidate } from "../../router/revalidate.js"

describe("action revalidate meta", () => {
  it("applyServerRevalidate deletes paths and tags", async () => {
    const store = memoryPrerenderCache({
      "/a": {
        html: "a",
        pathname: "/a",
        generatedAt: Date.now(),
        revalidate: false,
        tags: ["blog"],
      },
    })
    setGlobalPrerenderCache(store)

    const bump = action.post(
      { revalidate: { paths: ["/a"], tags: ["blog"] } },
      async () => ({ ok: true })
    )

    await applyServerRevalidate(bump.__kiruRevalidate)
    assert.equal(store.get("/a"), null)
  })
})
