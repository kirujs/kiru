import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  buildMutationWireBody,
  parseMutationWireBody,
  MAX_CLIENT_REQUESTED_QUERIES,
} from "../../remote/mutationWire.js"

describe("parseMutationWireBody", () => {
  it("passes scalar input through", () => {
    assert.deepEqual(parseMutationWireBody("santa"), {
      input: "santa",
      requested: [],
    })
  })

  it("parses envelope with requested entries", () => {
    const body = {
      input: { id: 1 },
      requested: [{ queryId: "r:1:get", input: "santa" }],
    }
    assert.deepEqual(parseMutationWireBody(body), {
      input: { id: 1 },
      requested: [{ queryId: "r:1:get", input: "santa" }],
    })
  })

  it("caps requested array length", () => {
    const requested = Array.from({ length: 20 }, (_, i) => ({
      queryId: "q",
      input: i,
    }))
    const { requested: capped } = parseMutationWireBody({ input: null, requested })
    assert.equal(capped.length, MAX_CLIENT_REQUESTED_QUERIES)
  })
})

describe("buildMutationWireBody", () => {
  it("returns bare input when no requested", () => {
    assert.equal(buildMutationWireBody(42), 42)
  })

  it("wraps input and requested", () => {
    assert.deepEqual(
      buildMutationWireBody(1, [{ queryId: "q", input: null }]),
      { input: 1, requested: [{ queryId: "q", input: null }] }
    )
  })
})
