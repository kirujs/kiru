import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { JSDOM } from "jsdom"
import {
  applyDocumentTitle,
  mergeAndSyncClientDocumentHead,
} from "../../router/documentHeadClient.js"
import { serializeDocumentHead } from "../../router/meta.js"

describe("documentHeadClient", () => {
  it("sets document.title from head.title", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>")
    const { document } = dom.window
    ;(globalThis as { document?: Document }).document = document

    applyDocumentTitle({ title: "About — Kiru" })

    assert.strictEqual(document.title, "About — Kiru")

    delete (globalThis as { document?: Document }).document
  })

  it("does not add or mutate meta tags on client sync", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>")
    const { document } = dom.window
    ;(globalThis as { document?: Document }).document = document

    document.head.innerHTML = serializeDocumentHead({
      title: "Before",
      description: "From SSR",
    })
    const metaBefore = document.head.querySelector('meta[name="description"]')

    mergeAndSyncClientDocumentHead(
      { title: "After" },
      { description: "Ignored on client nav" }
    )

    assert.strictEqual(document.title, "After")
    assert.strictEqual(
      document.head.querySelector('meta[name="description"]'),
      metaBefore
    )
    assert.strictEqual(metaBefore?.getAttribute("content"), "From SSR")

    delete (globalThis as { document?: Document }).document
  })

  it("leaves SSR head nodes in place when only the title changes", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>")
    const { document } = dom.window
    ;(globalThis as { document?: Document }).document = document

    document.head.innerHTML = serializeDocumentHead({
      title: "E2E SSR SEO",
      description: "E2E SSR app.",
      jsonLd: { "@type": "WebPage", name: "E2E SSR SEO" },
    })

    const titleBefore = document.head.querySelector("title")
    const metaBefore = document.head.querySelector('meta[name="description"]')
    const scriptBefore = document.head.querySelector(
      'script[type="application/ld+json"]'
    )

    mergeAndSyncClientDocumentHead(
      {
        title: "E2E SSR SEO",
        description: "E2E SSR app.",
        jsonLd: { "@type": "WebPage", name: "E2E SSR SEO" },
      },
      undefined
    )
    mergeAndSyncClientDocumentHead(
      {
        title: "E2E SSR SEO",
        description: "E2E SSR app.",
        jsonLd: { "@type": "WebPage", name: "E2E SSR SEO" },
      },
      undefined
    )

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

  it("page head title overrides route head on client sync", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>")
    const { document } = dom.window
    ;(globalThis as { document?: Document }).document = document

    mergeAndSyncClientDocumentHead(
      { title: "Route title" },
      { title: "Page title" }
    )

    assert.strictEqual(document.title, "Page title")

    delete (globalThis as { document?: Document }).document
  })
})
