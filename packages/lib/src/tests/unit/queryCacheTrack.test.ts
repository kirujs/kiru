import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  captureSyncQueryObservations,
  currentlyObservedQueries,
  noteQueryCacheKey,
} from "../../remote/queryCacheTrack.js"

describe("queryCacheTrack", () => {
  it("records keys only while the observation set is current", () => {
    const outer = captureSyncQueryObservations(() => {
      noteQueryCacheKey("a")
      const { observed: innerObserved } = captureSyncQueryObservations(() => {
        noteQueryCacheKey("b")
      })
      noteQueryCacheKey("c")
      return innerObserved
    })

    assert.deepEqual([...outer.observed].sort(), ["a", "c"])
    assert.deepEqual([...outer.value].sort(), ["b"])
    assert.equal(currentlyObservedQueries.current, undefined)
  })

  it("restores the previous observation set after nested capture", () => {
    const prev = new Set(["keep"])
    currentlyObservedQueries.current = prev
    const { observed } = captureSyncQueryObservations(() => {
      noteQueryCacheKey("x")
    })
    assert.deepEqual([...observed], ["x"])
    assert.equal(currentlyObservedQueries.current, prev)
    currentlyObservedQueries.current = undefined
  })
})
