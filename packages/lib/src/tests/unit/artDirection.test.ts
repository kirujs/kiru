import { describe, it } from "node:test"
import assert from "node:assert"
import { buildArtDirectionPictureHtml } from "../../image/artDirection.js"
import { defineImageConfig, resetImageConfigForTests } from "../../image/index.js"

describe("artDirection", () => {
  it("builds picture with separate desktop/mobile srcsets", () => {
    resetImageConfigForTests()
    defineImageConfig({ strategy: "runtime" })
    const html = buildArtDirectionPictureHtml({
      desktop: { src: "/desktop.jpg", width: 1440, height: 900 },
      mobile: { src: "/mobile.jpg", width: 750, height: 1334 },
      alt: "Hero",
    })
    assert.match(html, /<picture>/)
    assert.match(html, /media="\(min-width: 1000px\)"/)
    assert.match(html, /desktop\.jpg/)
    assert.match(html, /mobile\.jpg/)
  })
})
