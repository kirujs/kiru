import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { guardServerLoaderOnClient } from "../../router/devWarnings.js"
import { markRouterBootstrap } from "../../router/bootstrapMode.js"
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

describe("guardServerLoaderOnClient", () => {
  const bootstrapKey = "__kiru_routerBootstrap"

  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).window = globalThis
    delete (globalThis as Record<string, unknown>)[bootstrapKey]
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
    delete (globalThis as Record<string, unknown>)[bootstrapKey]
  })

  it("throws for pure CSR bootstrap", () => {
    markRouterBootstrap("csr")
    assert.throws(() => guardServerLoaderOnClient(), /serverLoader is not supported/)
  })

  it("throws for pure SSG bootstrap", () => {
    markRouterBootstrap("ssg")
    assert.throws(() => guardServerLoaderOnClient(), /serverLoader is not supported/)
  })

  it("does not throw for SSR bootstrap without RPC (warn only)", () => {
    markRouterBootstrap("ssr")
    assert.doesNotThrow(() => guardServerLoaderOnClient())
  })
})
