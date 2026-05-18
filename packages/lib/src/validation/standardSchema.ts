import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from "@standard-schema/spec"

/** Re-exported from `@standard-schema/spec` (optional peer). */
export type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
  StandardTypedV1,
} from "@standard-schema/spec"

export type StandardSchema<Input = unknown, Output = Input> =
  StandardSchemaV1<Input, Output>

/** JSON Schema export ([Standard JSON Schema](https://standardschema.dev/json-schema)). */
export type StandardJSONSchema<Input = unknown, Output = Input> =
  StandardJSONSchemaV1<Input, Output>

/**
 * Schemas that implement both Standard Schema validation and JSON Schema conversion
 * on the same `~standard` object (e.g. Zod 4+).
 */
export type StandardSchemaWithJson<Input = unknown, Output = Input> = {
  readonly "~standard": StandardSchemaV1.Props<Input, Output> &
    StandardJSONSchemaV1.Props<Input, Output>
}

/** Runtime check for {@link StandardSchemaV1} (`~standard.validate`). */
export function isStandardSchemaV1(value: unknown): value is StandardSchemaV1 {
  if (!value || typeof value !== "object" || !("~standard" in value)) return false
  const std = (value as StandardSchemaV1)["~standard"]
  return (
    !!std &&
    typeof std === "object" &&
    std.version === 1 &&
    typeof std.validate === "function"
  )
}

/** Runtime check for {@link StandardJSONSchemaV1} (`~standard.jsonSchema`). */
export function isStandardJSONSchemaV1(
  value: unknown
): value is StandardJSONSchemaV1 {
  if (!value || typeof value !== "object" || !("~standard" in value)) return false
  const std = (value as StandardJSONSchemaV1)["~standard"]
  return (
    !!std &&
    typeof std === "object" &&
    std.version === 1 &&
    typeof std.jsonSchema?.input === "function"
  )
}

/** Generate JSON Schema for a schema's **input** type. */
export function toInputJsonSchema(
  schema: StandardJSONSchemaV1,
  options: StandardJSONSchemaV1.Options
): Record<string, unknown> {
  return schema["~standard"].jsonSchema.input(options)
}

/** Generate JSON Schema for a schema's **output** type (after transforms). */
export function toOutputJsonSchema(
  schema: StandardJSONSchemaV1,
  options: StandardJSONSchemaV1.Options
): Record<string, unknown> {
  return schema["~standard"].jsonSchema.output(options)
}
