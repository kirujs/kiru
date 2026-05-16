import { describe, it } from "node:test"
import assert from "node:assert"
import {
  absoluteRouteUrl,
  addBase,
  formatPathname,
  normalizeBaseUrl,
  pathnameForMatch,
  resolvePathPolicy,
  stripBase,
} from "../../router/pathPolicy.js"

describe("pathPolicy", () => {
  it("resolvePathPolicy defaults to never trailing slash and root base", () => {
    const p = resolvePathPolicy()
    assert.strictEqual(p.baseUrl, "/")
    assert.strictEqual(p.trailingSlash, "never")
  })

  it("formatPathname appends trailing slash when policy is always", () => {
    assert.strictEqual(
      formatPathname("/about", { trailingSlash: "always" }),
      "/about/"
    )
    assert.strictEqual(formatPathname("/", { trailingSlash: "always" }), "/")
  })

  it("formatPathname strips trailing slash when policy is never", () => {
    assert.strictEqual(
      formatPathname("/about/", { trailingSlash: "never" }),
      "/about"
    )
  })

  it("pathnameForMatch strips baseUrl and normalizes slashes", () => {
    assert.strictEqual(
      pathnameForMatch("/app/about/", { baseUrl: "/app" }),
      "/about"
    )
    assert.strictEqual(pathnameForMatch("/app", { baseUrl: "/app" }), "/")
  })

  it("stripBase and addBase round-trip under a subpath", () => {
    const base = normalizeBaseUrl("/app")
    assert.strictEqual(stripBase("/app/blog/post", base), "/blog/post")
    assert.strictEqual(addBase("/blog/post", base), "/app/blog/post")
  })

  it("absoluteRouteUrl joins origin, baseUrl, and trailing slash", () => {
    const url = absoluteRouteUrl("https://example.com", "/about", {
      baseUrl: "/app",
      trailingSlash: "always",
    })
    assert.strictEqual(url, "https://example.com/app/about/")
  })

  it("absoluteRouteUrl formats root as origin plus slash", () => {
    assert.strictEqual(
      absoluteRouteUrl("https://example.com", "/", {}),
      "https://example.com/"
    )
  })
})
