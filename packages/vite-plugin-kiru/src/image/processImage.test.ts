import { describe, it } from "node:test"
import assert from "node:assert"
import sharp from "sharp"
import { BLUR_PLACEHOLDER_MAX_WIDTH } from "./constants.js"
import { isAvifBuffer, isJpegBuffer, isWebpBuffer } from "./format.js"
import {
  buildBlurDataURL,
  pickVariantFormat,
  processImageAsset,
  widthsToGenerate,
} from "./processImage.js"

async function solidJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 80, b: 40 },
    },
  })
    .jpeg()
    .toBuffer()
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  assert.ok(match, "expected data URL")
  return {
    mime: match[1]!,
    buffer: Buffer.from(match[2]!, "base64"),
  }
}

describe("widthsToGenerate", () => {
  it("caps at intrinsic width and includes intrinsic when no device size fits", () => {
    assert.deepStrictEqual(
      widthsToGenerate([640, 750, 1080], 900),
      [640, 750]
    )
    assert.deepStrictEqual(widthsToGenerate([640, 1080], 400), [400])
  })
})

describe("pickVariantFormat", () => {
  it("prefers avif when listed", () => {
    assert.strictEqual(pickVariantFormat(["webp", "avif"]), "avif")
    assert.strictEqual(pickVariantFormat(["webp"]), "webp")
  })
})

describe("buildBlurDataURL", () => {
  it("produces a tiny JPEG LQIP, not a responsive variant width", async () => {
    const input = await solidJpeg(1280, 720)
    const dataUrl = await buildBlurDataURL(sharp, input)
    const { mime, buffer } = parseDataUrl(dataUrl)

    assert.strictEqual(mime, "image/jpeg")
    assert.ok(isJpegBuffer(buffer))

    const meta = await sharp(buffer).metadata()
    assert.ok(meta.width !== undefined && meta.width <= BLUR_PLACEHOLDER_MAX_WIDTH)
    assert.ok(meta.height !== undefined && meta.height > 0)
    assert.ok(
      meta.height! <=
        Math.ceil((720 / 1280) * BLUR_PLACEHOLDER_MAX_WIDTH) + 1
    )
  })

  it("respects custom blur width and quality options", async () => {
    const input = await solidJpeg(800, 600)
    const dataUrl = await buildBlurDataURL(sharp, input, {
      maxWidth: 16,
      quality: 55,
    })
    const { buffer } = parseDataUrl(dataUrl)
    const meta = await sharp(buffer).metadata()
    assert.ok(meta.width !== undefined && meta.width <= 16)
    assert.strictEqual(meta.format, "jpeg")
  })
})

describe("processImageAsset", () => {
  it("emits webp variants at requested widths with correct format and dimensions", async () => {
    const input = await solidJpeg(1280, 720)
    const result = await processImageAsset(sharp, input, "/tmp/hero.jpg", {
      optimize: true,
      deviceSizes: [640, 750, 1200, 1920],
      quality: 75,
      formats: ["webp"],
    })

    assert.strictEqual(result.width, 1280)
    assert.strictEqual(result.height, 720)
    assert.strictEqual(result.variantFiles.length, 3)

    for (const variant of result.variantFiles) {
      assert.match(variant.fileName, /\.webp$/)
      assert.ok(isWebpBuffer(variant.buffer))
      assert.strictEqual(variant.format, "webp")
      const target = Number(variant.fileName.match(/-(\d+)w\./)?.[1])
      assert.ok(target !== undefined)
      assert.ok(
        variant.width <= target,
        `output width ${variant.width} should not exceed target ${target}`
      )
      assert.ok(variant.width > 0)
    }

    const widths = result.variantFiles.map((v) =>
      Number(v.fileName.match(/-(\d+)w\./)?.[1])
    )
    assert.deepStrictEqual(widths, [640, 750, 1200])
  })

  it("emits avif when configured", async () => {
    const input = await solidJpeg(640, 480)
    const result = await processImageAsset(sharp, input, "/tmp/hero.jpg", {
      optimize: true,
      deviceSizes: [640],
      quality: 70,
      formats: ["webp", "avif"],
    })

    assert.strictEqual(result.variantFiles.length, 1)
    const [variant] = result.variantFiles
    assert.strictEqual(variant!.format, "avif")
    assert.match(variant!.fileName, /\.avif$/)
    assert.ok(isAvifBuffer(variant!.buffer))
    assert.ok(variant!.width <= 640)
  })

  it("skips variants when optimize is false but still builds blur", async () => {
    const input = await solidJpeg(640, 480)
    const result = await processImageAsset(sharp, input, "/tmp/hero.jpg", {
      optimize: false,
      deviceSizes: [640],
      quality: 75,
      formats: ["webp"],
    })

    assert.strictEqual(result.variantFiles.length, 0)
    assert.ok(result.blurDataURL?.startsWith("data:image/jpeg;base64,"))
  })

  it("includes blurDataURL with small JPEG dimensions", async () => {
    const input = await solidJpeg(2000, 1000)
    const result = await processImageAsset(sharp, input, "/tmp/wide.jpg", {
      optimize: true,
      deviceSizes: [640],
      quality: 75,
      formats: ["webp"],
    })

    assert.ok(result.blurDataURL)
    const { buffer } = parseDataUrl(result.blurDataURL!)
    const meta = await sharp(buffer).metadata()
    assert.ok(meta.width !== undefined && meta.width <= BLUR_PLACEHOLDER_MAX_WIDTH)
  })
})
