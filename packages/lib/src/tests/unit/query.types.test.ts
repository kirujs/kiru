import { query } from "../../remote/query.js"

const idSchema = {
  parse: (input: unknown) => {
    if (typeof input !== "string") throw new Error("expected string")
    return input
  },
}

const voidQ = query(async () => 1)
const keyedQ = query(idSchema, async (id) => id)

if (0 as unknown as 1) {
  // @ts-expect-error void queries have no key()
  voidQ.key()
  // @ts-expect-error key() does not accept RemoteCallOptions
  keyedQ.key("santa", { signal: new AbortController().signal })
}

void keyedQ
void voidQ
