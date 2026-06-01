import { describe, it } from "node:test"
import assert from "node:assert"
import { lisIndices } from "../../../domRuntime/lis.js"

describe("domRuntime/lis", () => {
  it("finds longest increasing subsequence indices", () => {
    const stable = lisIndices([2, 0, 1, 3, 4])
    assert.ok(stable.has(1))
    assert.ok(stable.has(2))
    assert.ok(stable.size >= 3)
  })
})
