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

export type KiruValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: unknown }

/**
 * @deprecated Prefer {@link Schema} with {@link parseInput}.
 * Legacy wrapper shape; still accepted wherever {@link Schema} is allowed.
 */
export interface KiruValidator<T> {
  safeParse(input: unknown): KiruValidationResult<T>
}

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

/** @deprecated Use {@link Schema}. */
export type KiruSchemaInput<T> = Schema<T>

/** Alias for {@link Schema} on `action()` / `formAction()`. */
export type ActionSchema<TInput> = Schema<TInput>

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

/**
 * {@link parseInput} and throw a generic `Error` on failure (message only).
 */
export async function assertValid<T>(
  schema: Schema<T>,
  input: unknown,
  message = "Validation failed"
): Promise<T> {
  try {
    return await parseInput(schema, input)
  } catch {
    throw new Error(message)
  }
}
