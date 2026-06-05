import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { query } from "../../remote/query.js"
import { requested } from "../../remote/requested.js"
import {
  beginRequestedScope,
  endRequestedScope,
} from "../../remote/requestedScope.js"

describe("requested()", () => {
  it("yields matching wire entries up to limit", () => {
    const getPosts = query(async () => [])
    getPosts.__kiruQueryId = "r:test:getPosts"
    const listPosts = query(async () => [])
    listPosts.__kiruQueryId = "r:test:listPosts"

    beginRequestedScope([
      { queryId: "r:test:getPosts", input: "a" },
      { queryId: "r:test:getPosts", input: "b" },
      { queryId: "r:test:listPosts", input: { f: 1 } },
      { queryId: "r:other:q", input: null },
    ])
    try {
      const posts = [...requested(getPosts, 1)]
      assert.equal(posts.length, 1)
      assert.equal(posts[0]?.input, "a")
      assert.equal(typeof posts[0]?.refresh, "function")

      const all = [...requested(listPosts, 5)]
      assert.equal(all.length, 1)
      assert.deepEqual(all[0]?.input, { f: 1 })
    } finally {
      endRequestedScope()
    }
  })

  it("returns entries for any query id present in wire payload", () => {
    const q = query(async () => 1)
    q.__kiruQueryId = "r:test:q"
    beginRequestedScope([{ queryId: "r:test:q", input: null }])
    try {
      assert.equal([...requested(q, 3)].length, 1)
    } finally {
      endRequestedScope()
    }
  })
})
