import { describe, it } from "node:test"
import assert from "node:assert"
import { resolveMaxConcurrentRenders } from "./config.js"

describe("resolveMaxConcurrentRenders", () => {
  it("defaults to 10", () => {
    assert.strictEqual(resolveMaxConcurrentRenders(undefined), 10)
  })

  it("accepts Infinity", () => {
    assert.strictEqual(resolveMaxConcurrentRenders(Infinity), Infinity)
  })

  it("rejects invalid values", () => {
    assert.throws(() => resolveMaxConcurrentRenders(0))
    assert.throws(() => resolveMaxConcurrentRenders(-1))
    assert.throws(() => resolveMaxConcurrentRenders(Number.NaN))
  })
})
