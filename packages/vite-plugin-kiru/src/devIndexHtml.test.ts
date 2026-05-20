import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { extractHeadInjection } from "./devIndexHtml.js"

describe("extractHeadInjection", () => {
  it("returns appended head markup from transformIndexHtml", () => {
    const raw = `<!doctype html><html><head><title>A</title></head><body></body></html>`
    const transformed = `<!doctype html><html><head><title>A</title><!-- e2e-html-transform --></head><body></body></html>`
    const extra = extractHeadInjection(raw, transformed)
    assert.ok(extra.includes("e2e-html-transform"))
  })

  it("returns empty when head unchanged", () => {
    const html = `<html><head><meta charset="utf-8"/></head><body></body></html>`
    assert.equal(extractHeadInjection(html, html), "")
  })
})
