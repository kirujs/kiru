export function isPrimitiveChild(value: unknown): value is JSX.PrimitiveChild {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean" ||
    value === undefined ||
    value === null
  )
}
