import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { warnOnce } from "../../router/devWarnings.dev.js"

describe("devWarnings", () => {
  const originalWarn = console.warn

  beforeEach(() => {
    console.warn = () => {}
  })

  afterEach(() => {
    console.warn = originalWarn
  })

  it("warnOnce logs only once per key in development", () => {
    let count = 0
    console.warn = () => {
      count++
    }
    warnOnce("test-key", "first")
    warnOnce("test-key", "second")
    assert.strictEqual(count, 1)
  })
})
