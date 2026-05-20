import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createQueryValidation,
  validateSearchFromQuery,
} from "../../router/searchParams.js"

describe("validateSearchFromQuery", () => {
  const validator = {
    parse: (input: unknown) => {
      if (typeof input !== "object" || input === null || !("q" in input)) {
        throw new Error("Invalid input")
      }
      return input as { q: string }
    },
  }

  it("returns parsed data when valid", async () => {
    const config = createQueryValidation(validator)
    const r = await validateSearchFromQuery<{ q: string }>(config, {
      q: ["hello"],
    })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.data.q, "hello")
  })

  it("returns notFound when invalid", async () => {
    const config = createQueryValidation(validator)
    const r = await validateSearchFromQuery(config, {})
    assert.equal(r.ok, false)
  })
})
