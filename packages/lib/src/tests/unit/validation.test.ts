import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec"
import {
  parseInput,
  isStandardJSONSchemaV1,
  isStandardSchemaV1,
  toInputJsonSchema,
} from "../../validation/index.js"

function mockStandardSchema(): StandardSchemaV1<string, string> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate(value: unknown) {
        if (value === "ok") return { value: "ok" }
        return { issues: [{ message: "bad" }] }
      },
      types: {
        input: "" as unknown as string,
        output: "" as unknown as string,
      },
    },
  }
}

function mockStandardJsonSchema(): StandardJSONSchemaV1<string, string> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      jsonSchema: {
        input: () => ({ type: "string" }),
        output: () => ({ type: "string" }),
      },
      types: {
        input: "" as unknown as string,
        output: "" as unknown as string,
      },
    },
  }
}

describe("Schema / parseInput", () => {
  it("accepts valid input via safeParse", async () => {
    const schema = {
      safeParse: (input: unknown) => {
        if (typeof input !== "object" || input === null || !("n" in input)) {
          return { success: false as const, error: "Invalid input" }
        }
        return { success: true as const, data: input as { n: number } }
      },
    }
    const data = await parseInput(schema, { n: 1 })
    assert.equal(data.n, 1)
  })

  it("parseInput uses ~standard.validate", async () => {
    assert.equal(await parseInput(mockStandardSchema(), "ok"), "ok")
    await assert.rejects(() => parseInput(mockStandardSchema(), "x"))
  })

  it("parseInput supports async Standard Schema validate", async () => {
    const schema: StandardSchemaV1<string, string> = {
      "~standard": {
        version: 1,
        vendor: "test",
        async validate(value: unknown) {
          if (value === "ok") return { value: "ok" }
          return { issues: [{ message: "bad" }] }
        },
      },
    }
    assert.equal(await parseInput(schema, "ok"), "ok")
  })

  it("parseInput uses safeParse-style schemas", async () => {
    const schema = {
      safeParse(input: unknown) {
        if (input === "ok") return { success: true as const, data: "ok" }
        return { success: false as const, error: "bad" }
      },
    }
    assert.equal(await parseInput(schema, "ok"), "ok")
    await assert.rejects(() => parseInput(schema, "nope"))
  })

  it("parseInput uses parse-style schemas", async () => {
    const schema = {
      parse(input: unknown) {
        if (input === "ok") return "ok"
        throw new Error("bad")
      },
    }
    assert.equal(await parseInput(schema, "ok"), "ok")
    await assert.rejects(() => parseInput(schema, "nope"))
  })

  it("isStandardSchemaV1 and isStandardJSONSchemaV1 detect ~standard", () => {
    assert.equal(isStandardSchemaV1(mockStandardSchema()), true)
    assert.equal(isStandardJSONSchemaV1(mockStandardJsonSchema()), true)
    assert.equal(isStandardSchemaV1({}), false)
  })

  it("toInputJsonSchema calls jsonSchema.input", () => {
    const schema = mockStandardJsonSchema()
    assert.deepEqual(
      toInputJsonSchema(schema, { target: "draft-2020-12" }),
      { type: "string" }
    )
  })

  it("parseInput throws on failure", async () => {
    const schema = {
      parse: (input: unknown) => {
        if (typeof input !== "string") {
          throw new Error("Invalid input")
        }
        return input
      },
    }
    await assert.rejects(() => parseInput(schema, 1))
    assert.equal(await parseInput(schema, "x"), "x")
  })
})
