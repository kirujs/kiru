import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildRequestedFromTargets } from "../../remote/mutationResult.js"
import { buildMutationWireBody } from "../../remote/mutationWire.js"
import { query } from "../../remote/query.js"
import { mutation, requested } from "../../remote/index.js"
import {
  createRemoteExecutionForRequest,
  runInRemoteExecution,
} from "../../remote/index.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"
import { KIRU_QUERY_PATCHES_KEY } from "../../remote/queryPatch.js"
import { parseMutationWireBody } from "../../remote/mutationWire.js"

const idSchema = {
  parse: (input: unknown) => {
    if (typeof input !== "string") throw new Error("expected string")
    return input
  },
}

const filterSchema = {
  parse: (input: unknown) => {
    if (typeof input !== "object" || input === null || !("filter" in input)) {
      throw new Error("invalid")
    }
    return { filter: String((input as { filter: unknown }).filter) }
  },
}

describe("mutation .updates() wire entries", () => {
  it("maps factory and keyed instances to queryId + input", () => {
    const getPosts = query(idSchema, async (id: string) => id)
    getPosts.__kiruQueryId = "r:test:getPosts"
    const keyed = getPosts.key("santa")
    const wire = buildRequestedFromTargets([getPosts, keyed])
    assert.deepEqual(wire, [
      { queryId: "r:test:getPosts", input: null },
      { queryId: "r:test:getPosts", input: "santa" },
    ])
  })

  it("serializes optimistic override from withOverride instances", () => {
    const getPosts = query(idSchema, async (id: string) => [id])
    getPosts.__kiruQueryId = "r:test:opt"
    const optimistic = getPosts.key("santa").withOverride(() => ["new", "santa"])
    const wire = buildRequestedFromTargets([optimistic])
    assert.deepEqual(wire, [
      {
        queryId: "r:test:opt",
        input: "santa",
        optimistic: ["new", "santa"],
      },
    ])
  })
})

describe("mutation requested() integration", () => {
  it("refreshAll via wire requested entries attaches __kiruQueryPatches", async () => {
    const items = [
      { id: "1", tag: "work", label: "A" },
      { id: "2", tag: "play", label: "B" },
    ]

    const listFiltered = query(filterSchema, async ({ filter }) =>
      items.filter((item) => item.tag === filter)
    )
    listFiltered.__kiruQueryId = "r:test:listFiltered"

    const addItem = mutation(async () => {
      items.push({ id: "3", tag: "work", label: "C" })
      await requested(listFiltered, 2).refreshAll()
      return { ok: true }
    })
    addItem.__kiruMutationId = "r:test:addItem"

    const wireBody = buildMutationWireBody(null, [
      { queryId: "r:test:listFiltered", input: { filter: "work" } },
    ])
    const parsed = parseMutationWireBody(wireBody)
    assert.equal(parsed.requested.length, 1)

    const execution = createRemoteExecutionForRequest({
      context: {},
      signal: staticLoaderSignal(),
      request: new Request("http://localhost/"),
      headers: new Headers(),
      body: wireBody,
      entryActionId: "r:test:addItem",
    })

    const invokeResult = await runInRemoteExecution(execution, () =>
      addItem.__kiruInvoke({
        body: wireBody,
        query: {},
        context: {},
        signal: execution.request.signal,
        request: execution.request.raw,
        execution,
      })
    )

    const handlerResult = (invokeResult as { handlerResult: unknown }).handlerResult
    assert.equal((handlerResult as { ok: boolean }).ok, true)
    const patches = (invokeResult as Record<string, unknown>)[KIRU_QUERY_PATCHES_KEY]
    assert.ok(Array.isArray(patches))
    assert.ok((patches as unknown[]).length >= 1)
    const patch = (patches as Array<{ queryId: string; op: string; data: unknown }>)[0]
    assert.equal(patch?.queryId, "r:test:listFiltered")
    assert.equal(patch?.op, "refresh")
    assert.deepEqual(patch?.data, [
      { id: "1", tag: "work", label: "A" },
      { id: "3", tag: "work", label: "C" },
    ])
  })
})
