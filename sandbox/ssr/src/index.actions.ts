import { action } from "kiru/remote"
import { test } from "./test"

console.log(test)
interface Schema<T> {
  parse: (input: unknown) => input is T
}

const mySchema: Schema<{ name: string }> = {
  parse: (input): input is { name: string } =>
    !!input &&
    typeof input === "object" &&
    "name" in input &&
    typeof input.name === "string",
}

export const getSandboxServerEcho = action(async (ctx, _input: unknown) => {
  const name = ctx.user?.name ?? "guest"
  return `Remote OK: ${name} ${test}`
})


export const getServerEcho = action(mySchema, async (_ctx, input) => {
  return `Echo ${input.name}`
})
