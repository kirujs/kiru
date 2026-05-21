import { describe, it } from "node:test"
import assert from "node:assert"
import {
  appendUrlSegment,
  parseDirSegment,
  urlSegmentsToPath,
} from "./pathFromSegments.js"

describe("pathFromSegments", () => {
  it("parses route groups without url segment", () => {
    const g = parseDirSegment("(marketing)")
    assert.strictEqual(g.kind, "group")
    assert.deepStrictEqual(
      appendUrlSegment([], g),
      []
    )
  })

  it("parses dynamic segments", () => {
    const d = parseDirSegment("[slug]")
    assert.strictEqual(d.kind, "dynamic")
    if (d.kind === "dynamic") {
      assert.strictEqual(d.urlToken, "[slug]")
    }
    const c = parseDirSegment("[...rest]")
    if (c.kind === "dynamic") {
      assert.strictEqual(c.urlToken, "[...rest]")
    }
  })

  it("builds path from url segments", () => {
    assert.strictEqual(urlSegmentsToPath(["blog", "[slug]"]), "/blog/[slug]")
    assert.strictEqual(urlSegmentsToPath([]), "/")
  })
})
