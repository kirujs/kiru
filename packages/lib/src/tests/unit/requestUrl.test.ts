import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  normalizeRouterHash,
  parseQuery,
  parseRequestUrl,
  splitRouterTo,
} from "../../router/requestUrl.js"

describe("requestUrl", () => {
  it("parseQuery collects duplicate keys", () => {
    assert.deepStrictEqual(parseQuery("tag=a&tag=b"), { tag: ["a", "b"] })
  })

  it("parseRequestUrl handles empty search and hash only", () => {
    assert.deepStrictEqual(parseRequestUrl("/path"), {
      search: "",
      hash: "",
      query: {},
    })
    assert.deepStrictEqual(parseRequestUrl("/path#top"), {
      search: "",
      hash: "#top",
      query: {},
    })
  })

  it("splitRouterTo separates pathname, search, and hash", () => {
    assert.deepStrictEqual(splitRouterTo("/about#top"), {
      pathname: "/about",
      search: "",
      hash: "#top",
    })
    assert.deepStrictEqual(splitRouterTo("#intro"), {
      pathname: "",
      search: "",
      hash: "#intro",
    })
    assert.deepStrictEqual(splitRouterTo("/docs?tab=1#section"), {
      pathname: "/docs",
      search: "?tab=1",
      hash: "#section",
    })
    assert.deepStrictEqual(splitRouterTo("?q=1"), {
      pathname: "",
      search: "?q=1",
      hash: "",
    })
  })

  it("normalizeRouterHash adds # prefix and treats bare # as empty", () => {
    assert.equal(normalizeRouterHash(""), "")
    assert.equal(normalizeRouterHash("#"), "")
    assert.equal(normalizeRouterHash("#top"), "#top")
    assert.equal(normalizeRouterHash("top"), "#top")
  })
})
