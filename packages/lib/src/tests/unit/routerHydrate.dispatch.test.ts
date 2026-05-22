import { describe, it } from "node:test"
import assert from "node:assert"
import { ActionFailure } from "../../remote/actionFailure.js"

describe("ActionFailure.fromWire", () => {
  it("parses __kiruFail payload", () => {
    const err = ActionFailure.fromWire({
      __kiruFail: true,
      message: "nope",
      status: 401,
      code: "UNAUTHORIZED",
    })
    assert.ok(err)
    assert.strictEqual(err.message, "nope")
    assert.strictEqual(err.status, 401)
    assert.strictEqual(err.code, "UNAUTHORIZED")
  })
})

describe("ActionFailure.fromLegacyEnvelope", () => {
  it("parses legacy error.details.fieldErrors", () => {
    const err = ActionFailure.fromLegacyEnvelope({
      error: {
        code: "VALIDATION_ERROR",
        message: "bad",
        details: { fieldErrors: { x: "nope" } },
      },
    })
    assert.ok(err)
    assert.strictEqual(err.message, "bad")
    assert.deepStrictEqual(err.fields, { x: "nope" })
  })
})
