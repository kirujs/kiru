import { describe, it, afterEach } from "node:test"
import assert from "node:assert"
import {
  defineImageConfig,
  resetImageConfigForTests,
  getImageProps,
  createRuntimeImageLoader,
  setBuildImageManifest,
} from "../../image/index.js"

describe("image", () => {
  afterEach(() => {
    resetImageConfigForTests()
    setBuildImageManifest(null)
  })

  it("emits DPR srcset without sizes", () => {
    defineImageConfig({ strategy: "runtime" })
    const { props } = getImageProps({
      src: "/hero.jpg",
      alt: "Hero",
      width: 400,
      height: 300,
    })
    assert.match(props.srcSet ?? "", /1x/)
    assert.match(props.srcSet ?? "", /2x/)
    assert.ok(!props.srcSet?.includes("640w"))
    assert.strictEqual(props.width, 400)
    assert.strictEqual(props.height, 300)
  })

  it("emits width srcset when sizes is set", () => {
    defineImageConfig({ strategy: "runtime" })
    const { props } = getImageProps({
      src: "/hero.jpg",
      alt: "Hero",
      width: 1200,
      height: 800,
      sizes: "100vw",
    })
    assert.match(props.srcSet ?? "", /640w/)
    assert.match(props.srcSet ?? "", /1200w/)
    assert.strictEqual(props.sizes, "100vw")
  })

  it("caps widths at intrinsic width", () => {
    defineImageConfig({ strategy: "runtime" })
    const { props } = getImageProps({
      src: "/small.jpg",
      alt: "Small",
      width: 500,
      height: 500,
      sizes: "100vw",
    })
    assert.ok(!props.srcSet?.includes("640w"))
    assert.match(props.srcSet ?? "", /384w/)
  })

  it("unoptimized omits srcset", () => {
    const { props } = getImageProps({
      src: "/hero.jpg",
      alt: "Hero",
      width: 400,
      height: 300,
      unoptimized: true,
    })
    assert.strictEqual(props.src, "/hero.jpg")
    assert.strictEqual(props.srcSet, undefined)
  })

  it("svg is unoptimized by default", () => {
    defineImageConfig({ strategy: "runtime" })
    const { props } = getImageProps({
      src: "/icon.svg",
      alt: "Icon",
      width: 32,
      height: 32,
    })
    assert.strictEqual(props.srcSet, undefined)
  })

  it("overrideSrc sets src but keeps optimized srcset", () => {
    defineImageConfig({ strategy: "runtime" })
    const { props } = getImageProps({
      src: "/hero.jpg",
      alt: "Hero",
      width: 400,
      height: 300,
      overrideSrc: "/legacy.jpg",
    })
    assert.strictEqual(props.src, "/legacy.jpg")
    assert.match(props.srcSet ?? "", /_kiru\/image/)
  })

  it("ImageAsset infers dimensions", () => {
    const { props } = getImageProps({
      src: { src: "/a.jpg", width: 800, height: 600 },
      alt: "A",
    })
    assert.strictEqual(props.width, 800)
    assert.strictEqual(props.height, 600)
  })

  it("build loader uses manifest URLs", () => {
    defineImageConfig({ strategy: "build" })
    setBuildImageManifest({
      "/hero.jpg": {
        640: "/assets/hero-640.webp",
        1200: "/assets/hero-1200.webp",
      },
    })
    const { props } = getImageProps({
      src: "/hero.jpg",
      alt: "Hero",
      width: 1200,
      height: 800,
      sizes: "100vw",
    })
    assert.match(props.srcSet ?? "", /\/assets\/hero-640\.webp/)
    assert.strictEqual(props.src, "/assets/hero-1200.webp")
  })

  it("runtime loader encodes url query", () => {
    const loader = createRuntimeImageLoader(
      defineImageConfig({ strategy: "runtime", path: "/_kiru/image" })
    )
    const url = loader({ src: "/cat.jpg", width: 828, quality: 75 })
    assert.strictEqual(
      url,
      "/_kiru/image?url=%2Fcat.jpg&w=828&q=75"
    )
  })

  it("priority sets eager loading and preload link", () => {
    defineImageConfig({ strategy: "runtime" })
    const { props, preloadLink } = getImageProps({
      src: "/hero.jpg",
      alt: "Hero",
      width: 400,
      height: 300,
      priority: true,
    })
    assert.strictEqual(props.loading, "eager")
    assert.strictEqual(props.fetchPriority, "high")
    assert.strictEqual(preloadLink?.rel, "preload")
    assert.strictEqual(preloadLink?.as, "image")
  })
})
