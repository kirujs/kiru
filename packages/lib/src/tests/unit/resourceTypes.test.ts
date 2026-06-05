import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { resource, type NullableResource, type NonNullableResource } from "../../resource.js"
import { query } from "../../remote/query.js"

type AssertEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T,
>() => T extends B ? 1 : 2
  ? true
  : false

describe("resource types", () => {
  it("load: query with defaultState is NonNullableResource", () => {
    const counterQuery = query(() => ({ count: 0 }))
    const counter = resource({ load: counterQuery, defaultState: { count: 0 } })

    type ValueType = (typeof counter)["value"]
    const _nonNull: AssertEqual<ValueType, { count: number }> = true
    const _resource: AssertEqual<
      typeof counter,
      NonNullableResource<{ count: number }>
    > = true
    assert.equal(_nonNull, true)
    assert.equal(_resource, true)
    assert.equal(counter.value.count, 0)
  })

  it("load: query without defaultState is NullableResource", () => {
    const counterQuery = query(() => ({ count: 0 }))
    const counter = resource({ load: counterQuery })

    type ValueType = (typeof counter)["value"]
    const _nullable: AssertEqual<ValueType, { count: number } | null> = true
    const _resource: AssertEqual<
      typeof counter,
      NullableResource<{ count: number }>
    > = true
    assert.equal(_nullable, true)
    assert.equal(_resource, true)
  })
})
