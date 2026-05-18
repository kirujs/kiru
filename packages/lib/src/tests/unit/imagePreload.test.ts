import { describe, it } from "node:test"
import assert from "node:assert"
import {
  mergeImagePreloadsIntoHead,
  registerImagePreload,
  runWithImagePreloadRegistry,
} from "../../image/preloadRegistry.server.js"

describe("imagePreloadRegistry", () => {
  it("collects preloads within registry scope", () => {
    runWithImagePreloadRegistry(() => {
      registerImagePreload({
        rel: "preload",
        as: "image",
        href: "/hero.webp",
        imageSrcSet: "/hero-640.webp 640w",
        imageSizes: "100vw",
      })
      const merged = mergeImagePreloadsIntoHead({ title: "T" })
      assert.strictEqual(merged.links?.length, 1)
      assert.strictEqual(merged.links?.[0]?.rel, "preload")
      assert.strictEqual(merged.links?.[0]?.href, "/hero.webp")
      assert.strictEqual(merged.links?.[0]?.imagesrcset, "/hero-640.webp 640w")
    })
  })

  it("does not leak preloads across registry scopes", () => {
    runWithImagePreloadRegistry(() => {
      registerImagePreload({
        rel: "preload",
        as: "image",
        href: "/a.webp",
      })
    })
    const merged = mergeImagePreloadsIntoHead({ title: "T" })
    assert.strictEqual(merged.links, undefined)
  })
})
