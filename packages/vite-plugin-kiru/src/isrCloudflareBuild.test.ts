import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { assertCloudflareRouteBuildMeta } from "./assertCloudflareBuildMeta.js"
import type { SsgRouteBuildMeta } from "./ssgCacheTypes.js"

describe("assertCloudflareRouteBuildMeta", () => {
  it("throws for timed revalidate on a route", () => {
    const buildMeta: SsgRouteBuildMeta = {
      byRouteId: {
        "/blog": { revalidate: 60 },
      },
    }
    assert.throws(
      () => assertCloudflareRouteBuildMeta(buildMeta),
      /not supported on deploy target "cloudflare"/
    )
  })

  it("throws for cache tags on a route", () => {
    const buildMeta: SsgRouteBuildMeta = {
      byRouteId: {
        "/tagged": { tags: ["posts"] },
      },
    }
    assert.throws(() => assertCloudflareRouteBuildMeta(buildMeta))
  })

  it("allows immutable prerender (revalidate: false)", () => {
    const buildMeta: SsgRouteBuildMeta = {
      byRouteId: {
        "/static": { revalidate: false },
      },
    }
    assert.doesNotThrow(() => assertCloudflareRouteBuildMeta(buildMeta))
  })

  it("allows force-dynamic", () => {
    const buildMeta: SsgRouteBuildMeta = {
      byRouteId: {
        "/dynamic": { dynamic: "force-dynamic" },
      },
    }
    assert.doesNotThrow(() => assertCloudflareRouteBuildMeta(buildMeta))
  })

  it("no-ops when byRouteId is empty", () => {
    assert.doesNotThrow(() =>
      assertCloudflareRouteBuildMeta({ byRouteId: {} })
    )
  })
})
