import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mutation, requested } from "../../remote/index.js"
import {
  createRemoteExecutionForRequest,
  runInRemoteExecution,
} from "../../remote/index.js"
import { query } from "../../remote/query.js"
import { requested as requestedFn } from "../../remote/requested.js"
import {
  beginRequestedScope,
  endRequestedScope,
} from "../../remote/requestedScope.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"
import { KIRU_QUERY_PATCHES_KEY } from "../../remote/queryPatch.js"
import { buildMutationWireBody } from "../../remote/mutationWire.js"

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
      const posts = [...requestedFn(getPosts, 1)]
      assert.equal(posts.length, 1)
      assert.equal(posts[0]?.input, "a")
      assert.equal(typeof posts[0]?.refresh, "function")

      const all = [...requestedFn(listPosts, 5)]
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
      assert.equal([...requestedFn(q, 3)].length, 1)
    } finally {
      endRequestedScope()
    }
  })

  it("yields refreshable keyed query handle for query.refresh()", async () => {
    const idSchema = {
      parse: (input: unknown) => {
        if (typeof input !== "string") throw new Error("expected string")
        return input
      },
    }
    const getPosts = query(idSchema, async (id: string) => [id])
    getPosts.__kiruQueryId = "r:test:getPostsRefresh"

    beginRequestedScope([{ queryId: "r:test:getPostsRefresh", input: "santa" }])
    try {
      const [entry] = [...requestedFn(getPosts, 1)]
      assert.equal(entry?.input, "santa")
      assert.equal(typeof entry?.query.refresh, "function")
      assert.equal(
        "input" in entry!.query ? entry!.query.input : undefined,
        "santa"
      )
    } finally {
      endRequestedScope()
    }
  })

  it("yields void factory as refreshable query for query.refresh()", () => {
    const listTodos = query(async () => ["a"])
    listTodos.__kiruQueryId = "r:test:voidRefresh"

    beginRequestedScope([{ queryId: "r:test:voidRefresh", input: null }])
    try {
      const [entry] = [...requestedFn(listTodos, 1)]
      assert.equal(entry?.input, null)
      assert.equal(typeof entry?.query.refresh, "function")
      assert.equal(listTodos.__kiruQueryVoid, true)
    } finally {
      endRequestedScope()
    }
  })
})

describe("requested() handler integration", () => {
  it("refreshes via query.refresh() in handler loop", async () => {
    const items = ["a", "b"]
    const getPosts = query(async () => [...items])
    getPosts.__kiruQueryId = "r:test:loopRefresh"

    const addPost = mutation(async () => {
      items.push("c")
      for (const { query: q } of requested(getPosts, 1)) {
        await q.refresh()
      }
      return { ok: true }
    })
    addPost.__kiruMutationId = "r:test:addPost"

    const wireBody = buildMutationWireBody(null, [
      { queryId: "r:test:loopRefresh", input: null },
    ])
    const execution = createRemoteExecutionForRequest({
      context: {},
      signal: staticLoaderSignal(),
      request: new Request("http://localhost/"),
      headers: new Headers(),
      body: wireBody,
      entryActionId: "r:test:addPost",
    })

    const invokeResult = await runInRemoteExecution(execution, () =>
      addPost.__kiruInvoke({
        body: wireBody,
        query: {},
        context: {},
        signal: execution.request.signal,
        request: execution.request.raw,
        execution,
      })
    )

    const handlerResult = (invokeResult as { handlerResult: unknown }).handlerResult
    const patches = (handlerResult as Record<string, unknown>)[KIRU_QUERY_PATCHES_KEY]
    assert.ok(Array.isArray(patches))
    assert.deepEqual(
      (patches as Array<{ op: string; data: string[] }>)[0]?.data,
      ["a", "b", "c"]
    )
  })
})
