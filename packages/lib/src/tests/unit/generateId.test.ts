import assert from "node:assert"
import { describe, it } from "node:test"
import { generateRandomID } from "../../utils/generateId.js"

describe("generateId", () => {
  it("generate 1,000,000 ids and check for collisions", () => {
    const idsArr = Array.from({ length: 1000000 }).map(() => generateRandomID())
    const idSet = new Set([...idsArr])

    assert.strictEqual(
      idsArr.length,
      idSet.size,
      `[69420]: no duplicates found 🙈🙉🙊`
    )
  })
})
