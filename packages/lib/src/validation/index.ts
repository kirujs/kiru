import type { StandardSchemaV1 } from "@standard-schema/spec"

export type {
  StandardJSONSchema,
  StandardJSONSchemaV1,
  StandardSchema,
  StandardSchemaV1,
  StandardSchemaWithJson,
  StandardTypedV1,
} from "./standardSchema.js"

export {
  isStandardJSONSchemaV1,
  isStandardSchemaV1,
  toInputJsonSchema,
  toOutputJsonSchema,
} from "./standardSchema.js"

/**
 * Input schema for actions, loaders, and search validation.
 *
 * - [Standard Schema](https://standardschema.dev) (`~standard.validate`) — Zod 4+, Valibot, ArkType, …
 * - `{ safeParse }` — Zod 3-style or custom validators
 * - `{ parse }` — throws on invalid input
 */
export type Schema<TInput> =
  | StandardSchemaV1<unknown, TInput>
  | {
      parse(input: unknown): TInput
    }
  | {
      safeParse(
        input: unknown
      ):
        | { success: true; data: TInput }
        | { success: false; error: unknown }
    }

/** Alias for {@link Schema} on `mutation(schema, handler)` / `form(schema, handler)`. */
export type ActionSchema<TInput> = Schema<TInput>

/** Output type inferred from a {@link Schema} (Standard Schema, `parse`, or `safeParse`). */
export type InferSchemaOutput<S> = S extends StandardSchemaV1<unknown, infer O>
  ? O
  : S extends Schema<infer O>
    ? O
    : S extends { parse(input: unknown): infer O }
      ? O
      : unknown

/**
 * Parse `input` with a {@link Schema}. Supports async Standard Schema `validate`.
 *
 * @throws Standard Schema failure result (`{ issues }`), `safeParse` error value, or `parse` exceptions
 * @throws `Error` when `schema` is not a recognized shape
 */
export async function parseInput<T>(
  schema: Schema<T>,
  input: unknown
): Promise<T> {
  if (schema && typeof schema === "object" && "~standard" in schema) {
    const result = await schema["~standard"].validate(input)
    if (result.issues) {
      throw result
    }
    return result.value
  }

  if (
    schema &&
    typeof schema === "object" &&
    "safeParse" in schema &&
    typeof schema.safeParse === "function"
  ) {
    const result = schema.safeParse(input)
    if (!result.success) {
      throw result.error
    }
    return result.data
  }

  if (
    schema &&
    typeof schema === "object" &&
    "parse" in schema &&
    typeof schema.parse === "function"
  ) {
    return schema.parse(input)
  }

  throw new Error("[kiru] Invalid schema")
}

/**
 * Build a {@link Schema} with a `safeParse` implementation from a type guard.
 */
export function kiruValidatorFromParseGuard<Input>(
  guard: (input: unknown) => input is Input
): Schema<Input> {
  return {
    safeParse(input: unknown) {
      if (guard(input)) return { success: true as const, data: input }
      return { success: false as const, error: null }
    },
  }
}
