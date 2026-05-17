import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { JSDOM } from "jsdom"
import { syncClientDocumentHead } from "../../router/documentHeadClient.js"
import { serializeDocumentHead } from "../../router/meta.js"

describe("documentHeadClient", () => {
  it("reconciles SSR head tags instead of duplicating them", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>")
    const { document } = dom.window
    ;(globalThis as { document?: Document }).document = document

    const headHtml = serializeDocumentHead({
      title: "E2E SSR SEO",
      description: "E2E SSR app.",
      jsonLd: { "@type": "WebPage", name: "E2E SSR SEO" },
    })
    document.head.innerHTML = headHtml

    const titleBefore = document.head.querySelector("title")
    const metaBefore = document.head.querySelector('meta[name="description"]')
    const scriptBefore = document.head.querySelector(
      'script[type="application/ld+json"]'
    )

    const head = {
      title: "E2E SSR SEO",
      description: "E2E SSR app.",
      jsonLd: { "@type": "WebPage", name: "E2E SSR SEO" },
    }
    syncClientDocumentHead(head)
    syncClientDocumentHead(head)

    assert.strictEqual(document.head.querySelectorAll("title").length, 1)
    assert.strictEqual(
      document.head.querySelectorAll('meta[name="description"]').length,
      1
    )
    assert.strictEqual(
      document.head.querySelectorAll('script[type="application/ld+json"]').length,
      1
    )
    assert.strictEqual(document.head.querySelector("title"), titleBefore)
    assert.strictEqual(
      document.head.querySelector('meta[name="description"]'),
      metaBefore
    )
    assert.strictEqual(
      document.head.querySelector('script[type="application/ld+json"]'),
      scriptBefore
    )

    delete (globalThis as { document?: Document }).document
  })

  it("updates existing nodes when head meta changes", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>")
    const { document } = dom.window
    ;(globalThis as { document?: Document }).document = document

    document.head.innerHTML = serializeDocumentHead({
      title: "Before",
      description: "Old description",
    })

    const titleEl = document.head.querySelector("title")!
    const metaEl = document.head.querySelector('meta[name="description"]')!

    syncClientDocumentHead({
      title: "After",
      description: "New description",
    })

    assert.strictEqual(titleEl, document.head.querySelector("title"))
    assert.strictEqual(metaEl, document.head.querySelector('meta[name="description"]'))
    assert.strictEqual(titleEl.textContent, "After")
    assert.strictEqual(metaEl.getAttribute("content"), "New description")
    assert.strictEqual(document.title, "After")

    delete (globalThis as { document?: Document }).document
  })

  it("removes managed elements dropped from the desired head", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>")
    const { document } = dom.window
    ;(globalThis as { document?: Document }).document = document

    document.head.innerHTML = serializeDocumentHead({
      title: "T",
      description: "D",
      robots: "noindex",
    })

    syncClientDocumentHead({ title: "T" })

    assert.strictEqual(
      document.head.querySelectorAll('meta[name="description"]').length,
      0
    )
    assert.strictEqual(
      document.head.querySelectorAll('meta[name="robots"]').length,
      0
    )

    delete (globalThis as { document?: Document }).document
  })
})
