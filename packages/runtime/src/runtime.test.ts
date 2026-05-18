import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertISRAllowed,
  getISRWarningsForTarget,
  getRuntimeCapabilities,
  isStaticAssetPathname,
} from "./index.js"

describe("@kirujs/runtime", () => {
  it("node and bun support ISR", () => {
    assert.equal(getRuntimeCapabilities("node").isr, true)
    assert.equal(getRuntimeCapabilities("bun").isr, true)
  })

  it("cloudflare disables ISR capabilities", () => {
    const caps = getRuntimeCapabilities("cloudflare")
    assert.equal(caps.isr, false)
    assert.equal(caps.fs, false)
  })

  it("assertISRAllowed throws for timed revalidate on cloudflare", () => {
    assert.throws(() =>
      assertISRAllowed("cloudflare", { revalidate: 60 }, { routeId: "/blog" })
    )
  })

  it("assertISRAllowed allows immutable prerender on cloudflare", () => {
    assert.doesNotThrow(() =>
      assertISRAllowed("cloudflare", { revalidate: false })
    )
  })

  it("isStaticAssetPathname excludes html shell paths", () => {
    assert.equal(isStaticAssetPathname("/assets/foo.js"), true)
    assert.equal(isStaticAssetPathname("/"), false)
    assert.equal(isStaticAssetPathname("/index.html"), false)
    assert.equal(isStaticAssetPathname("/robots.txt"), true)
  })

  it("getISRWarningsForTarget returns warnings without throwing", () => {
    const w = getISRWarningsForTarget("cloudflare", {
      revalidate: 1,
      tags: ["x"],
    })
    assert.equal(w.length, 2)
  })
})
