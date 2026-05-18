import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import {
  guardServerLoaderOnClient,
  markRouterBootstrap,
  warnOnce,
} from "../../router/devWarnings.js"

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
    assert.throws(() => guardServerLoaderOnClient(), /kiru\/router\/csr/)
  })

  it("throws for pure SSG bootstrap", () => {
    markRouterBootstrap("ssg")
    assert.throws(() => guardServerLoaderOnClient(), /kiru\/router\/ssg/)
  })

  it("does not throw for SSR bootstrap without RPC (warn only)", () => {
    markRouterBootstrap("ssr")
    assert.doesNotThrow(() => guardServerLoaderOnClient())
  })
})
