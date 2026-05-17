import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseQuery, parseRequestUrl } from "../../router/requestUrl.js"

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
})
