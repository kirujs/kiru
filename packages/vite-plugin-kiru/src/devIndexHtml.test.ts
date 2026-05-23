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

  it("returns only new tags when Vite prepends @vite/client", () => {
    const raw = `<!doctype html><html><head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    {{kiru_head}}
  </head><body></body></html>`
    const transformed = `<!doctype html><html><head>
    <script type="module" src="/@vite/client"></script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    {{kiru_head}}
    <script>window.__KIRU_DEVTOOLS_PATHNAME__ = "/__devtools__";</script>
    <script type="module" src="/__devtools_host__.js" async></script>
  </head><body></body></html>`
    const extra = extractHeadInjection(raw, transformed)
    assert.match(extra, /@vite\/client/)
    assert.match(extra, /__KIRU_DEVTOOLS_PATHNAME__/)
    assert.doesNotMatch(extra, /\{\{kiru_head\}\}/)
    assert.doesNotMatch(extra, /name="viewport"/)
  })
})
