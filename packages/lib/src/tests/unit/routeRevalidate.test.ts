import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  defineISR,
  getISRRevalidate,
  getISRTags,
  readRouteISRExport,
} from "../../router/routeRevalidate.js"
import { cachePolicyToHeaders } from "../../router/routeResponse.js"

describe("routeRevalidate", () => {
  it("defineISR + readRouteISRExport (hybrid)", () => {
    const mod = {
      isr: defineISR({ revalidate: 60, tags: ["a", "b"], dynamic: "force-static" }),
    }
    const isr = readRouteISRExport(mod)
    assert.equal(getISRRevalidate(isr), 60)
    assert.deepEqual(getISRTags(isr), ["a", "b"])
    assert.equal(isr?.dynamic, "force-static")
  })

  it("defineISR force-dynamic strips cache fields when read", () => {
    const isr = readRouteISRExport({
      isr: defineISR({ dynamic: "force-dynamic" }),
    })
    assert.deepEqual(isr, { dynamic: "force-dynamic" })
  })

  it("readRouteISRExport ignores top-level revalidate/tags/dynamic (isr export only)", () => {
    assert.equal(readRouteISRExport({ revalidate: 30 }), undefined)
    assert.equal(
      readRouteISRExport({ tags: ["legacy"], dynamic: "force-dynamic" }),
      undefined
    )
  })

  it("cachePolicyToHeaders with revalidate seconds", () => {
    const h = cachePolicyToHeaders(undefined, true, 60)
    assert.match(h["cache-control"], /s-maxage=60/)
    assert.match(h["cache-control"], /stale-while-revalidate=60/)
  })
})
