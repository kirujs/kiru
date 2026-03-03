import { describe, it } from "node:test"
import assert from "node:assert"
import * as kiru from "../../index.js"

describe("computed signals", () => {
  it("returns up-to-date value after multiple synchronous source updates, if explicitly observed", () => {
    const x = kiru.signal(0)
    const y = kiru.signal(0)
    const pos = kiru.computed(() => ({ x: x.value, y: y.value }))

    x.value = 96
    y.value = 12
    assert.deepStrictEqual(pos.value, { x: 96, y: 12 })

    x.value = 4
    y.value = 64
    assert.deepStrictEqual(pos.value, { x: 4, y: 64 })
  })
  it("does not evaluate until observed", async () => {
    const x = kiru.signal(0)
    const y = kiru.signal(0)
    let timesEvaluated = 0
    const pos = kiru.computed(() => {
      timesEvaluated++
      return { x: x.value, y: y.value }
    })

    assert.strictEqual(timesEvaluated, 0)

    x.value = 96
    y.value = 12
    assert.strictEqual(timesEvaluated, 0)

    await new Promise<void>((resolve) => queueMicrotask(() => resolve()))
    // there are no subscribers yet, so the computed signal is not evaluated
    assert.strictEqual(timesEvaluated, 0)

    // explicit read triggers immediate evaluation
    assert.deepStrictEqual(pos.value, { x: 96, y: 12 })
    assert.strictEqual(timesEvaluated, 1)

    // reading the value again should not trigger a new evaluation, because no source signals were updated
    assert.deepStrictEqual(pos.value, { x: 96, y: 12 })
    assert.strictEqual(timesEvaluated, 1)
  })

  it("flushes to latest values when read after source updates", async () => {
    const x = kiru.signal(0)
    const y = kiru.signal(0)
    let timesEvaluated = 0
    const pos = kiru.computed(() => {
      timesEvaluated++
      return { x: x.value, y: y.value }
    })

    // mark as observed (e.g. like a DOM binding)
    pos.subscribe(() => {})
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()))
    assert.strictEqual(timesEvaluated, 1)

    x.value = 4
    y.value = 64
    // updates alone should not eagerly re-run the computed
    assert.strictEqual(timesEvaluated, 1)

    // but reading the value should always see the latest state
    assert.deepStrictEqual(pos.value, { x: 4, y: 64 })
    assert.strictEqual(timesEvaluated, 2)
  })
})
