import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { interpolateRoutePath } from "../../router/routePaths.js"

describe("interpolateRoutePath", () => {
  it("returns / for root pattern", () => {
    assert.equal(interpolateRoutePath("/"), "/")
  })

  it("substitutes a required dynamic segment", () => {
    assert.equal(
      interpolateRoutePath("/blog/[slug]", { slug: "hello world" }),
      "/blog/hello%20world"
    )
  })

  it("omits optional segment when param is missing", () => {
    assert.equal(interpolateRoutePath("/items/[[id]]", {}), "/items")
    assert.equal(
      interpolateRoutePath("/items/[[id]]", { id: "5" }),
      "/items/5"
    )
  })

  it("expands catch-all segments", () => {
    assert.equal(
      interpolateRoutePath("/docs/[...slug]", { slug: "a/b/c" }),
      "/docs/a/b/c"
    )
  })

  it("throws when a required param is missing", () => {
    assert.throws(() => interpolateRoutePath("/users/[id]", {}), /Missing required param/)
  })
})
