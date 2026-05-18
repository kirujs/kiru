import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  memoryPrerenderCache,
  setGlobalPrerenderCache,
} from "../../router/prerenderCache.js"
import { revalidatePath, revalidateTag } from "../../router/revalidate.js"

describe("revalidate", () => {
  it("revalidatePath deletes cache entry", async () => {
    const store = memoryPrerenderCache({
      "/x": {
        html: "hi",
        pathname: "/x",
        generatedAt: Date.now(),
        revalidate: 60,
        tags: ["t"],
      },
    })
    setGlobalPrerenderCache(store)
    await revalidatePath("/x")
    assert.equal(store.get("/x"), null)
  })

  it("revalidateTag deletes tagged paths", async () => {
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
    await revalidateTag("blog")
    assert.equal(store.get("/a"), null)
  })
})
