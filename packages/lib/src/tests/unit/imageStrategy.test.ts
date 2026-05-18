import { describe, it } from "node:test"
import assert from "node:assert"
import { defineImageConfig, resetImageConfigForTests } from "../../image/index.js"
import {
  usesBuildImageStrategy,
  usesRuntimeImageOptimizer,
} from "../../image/strategy.js"
import { createImageOptimizerIfRuntime } from "../../router/imageOptimizer.js"

describe("image strategy", () => {
  it("usesRuntimeImageOptimizer only for runtime strategy", () => {
    resetImageConfigForTests()
    const runtime = defineImageConfig({ strategy: "runtime" })
    const build = defineImageConfig({ strategy: "build" })
    const off = defineImageConfig({ strategy: "runtime", unoptimized: true })

    assert.strictEqual(usesRuntimeImageOptimizer(runtime), true)
    assert.strictEqual(usesBuildImageStrategy(build), true)
    assert.strictEqual(usesRuntimeImageOptimizer(build), false)
    assert.strictEqual(usesRuntimeImageOptimizer(off), false)
  })

  it("createImageOptimizerIfRuntime returns null for build strategy", () => {
    resetImageConfigForTests()
    const build = defineImageConfig({ strategy: "build" })
    assert.strictEqual(
      createImageOptimizerIfRuntime({ root: process.cwd(), config: build }),
      null
    )
  })
})
