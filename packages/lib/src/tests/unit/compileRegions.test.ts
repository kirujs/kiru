import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  regionAt,
  validateRegions,
  type CompileRegion,
} from "../../compileRegions.js"

describe("compileRegions", () => {
  it("validateRegions rejects slot index on template domain", () => {
    const regions: CompileRegion[] = [{ kind: "text", slot: 0 }]
    assert.throws(() => validateRegions(regions, "template"))
  })

  it("validateRegions rejects anchor on slot domain", () => {
    const regions: CompileRegion[] = [{ kind: "text", anchor: 0 }]
    assert.throws(() => validateRegions(regions, "slot"))
  })

  it("regionAt finds template region by anchor", () => {
    const regions: CompileRegion[] = [
      { kind: "conditional", anchor: 0 },
      { kind: "text", anchor: 1 },
    ]
    assert.deepEqual(regionAt(regions, 1, "template"), {
      kind: "text",
      anchor: 1,
    })
  })

  it("regionAt finds slot region by index", () => {
    const regions: CompileRegion[] = [{ kind: "node", slot: 2 }]
    assert.deepEqual(regionAt(regions, 2, "slot"), { kind: "node", slot: 2 })
  })
})
