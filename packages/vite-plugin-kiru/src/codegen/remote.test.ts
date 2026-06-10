import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "./shared.js"
import { prepareRemoteFunctions } from "./remote.js"

const PROJECT_ROOT = "/project"
const ACTIONS_FILE = `${PROJECT_ROOT}/src/pages/demo.remote.ts`

function transformRemote(source: string, ssr: boolean): string {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const code = new MagicString(source)
  prepareRemoteFunctions(
    {
      code,
      ast,
      isBuild: false,
      fileLinkFormatter: (id) => id,
      filePath: ACTIONS_FILE,
      log: () => {},
    },
    PROJECT_ROOT,
    ssr
  )
  return code.toString()
}

describe("prepareRemoteFunctions — default export (approach A)", () => {
  it("client stubs anonymous default namespace", () => {
    const out = transformRemote(
      `
import { mutation } from "kiru/remote"
export default {
  get: mutation(async () => "ok"),
}
`,
      false
    )
    assert.match(out, /export default \{ get: async \(\.\.\.args\)/)
    assert.match(out, /default\.get/)
    assert.doesNotMatch(out, /__kiru_default/)
    assert.doesNotMatch(out, /async \(\) => "ok"/)
    assert.doesNotMatch(out, /import \{ mutation \} from "kiru\/remote"/)
    assert.match(out, /import \{ __\$mutation, __\$defineQuery \} from "kiru\/remote"/)
  })

  it("SSR rewrites anonymous default namespace and registers default.*", () => {
    const out = transformRemote(
      `
import { mutation } from "kiru/remote"
export default {
  get: mutation(async () => "ok"),
}
`,
      true
    )
    assert.match(out, /const __kiru_default = \{/)
    assert.match(out, /export default __kiru_default/)
    assert.match(out, /"default\.get": __kiru_default\.get/)
    assert.match(out, /__kiru_default\.get\.__kiruMutationId/)
  })

  it("client and SSR handle flat default export", () => {
    const client = transformRemote(
      `
import { mutation } from "kiru/remote"
export default mutation(async () => "flat")
`,
      false
    )
    assert.match(client, /export default async \(\.\.\.args\)/)
    assert.match(client, /default/)

    const server = transformRemote(
      `
import { mutation } from "kiru/remote"
export default mutation(async () => "flat")
`,
      true
    )
    assert.match(server, /const __kiru_default = mutation\(/)
    assert.match(server, /"default": __kiru_default/)
  })

  it("coexists with named exports", () => {
    const out = transformRemote(
      `
import { mutation } from "kiru/remote"
export const foo = mutation(async () => "foo")
export default { get: mutation(async () => "d") }
`,
      true
    )
    assert.match(out, /"foo": foo/)
    assert.match(out, /"default\.get": __kiru_default\.get/)
  })

})

describe("prepareRemoteFunctions — default export (approach B)", () => {
  it("SSR registers default.* with linked binding refs, no __kiru_default", () => {
    const out = transformRemote(
      `
import { query } from "kiru/remote"
const users = {
  get: query(async () => "u"),
}
export default users
`,
      true
    )
    assert.match(out, /"default\.get": users\.get/)
    assert.match(out, /users\.get\.__kiruQueryId.*default\.get/)
    assert.doesNotMatch(out, /__kiru_default/)
    assert.match(out, /export default users/)
  })

  it("client stubs linked const and keeps export default users", () => {
    const out = transformRemote(
      `
import { query } from "kiru/remote"
const users = {
  get: query(async () => "u"),
}
export default users
`,
      false
    )
    assert.match(out, /const users = \{ get: __\$defineQuery/)
    assert.match(out, /export default users/)
    assert.match(out, /default\.get/)
    assert.doesNotMatch(out, /async \(\) => "u"/)
    assert.doesNotMatch(out, /import \{ query \} from "kiru\/remote"/)
  })

  it("client strips mixed kiru/remote imports and keeps codegen runtime import", () => {
    const out = transformRemote(
      `
import { form, getRequestEvent, query, requested } from "kiru/remote"
export const get = query(async () => "ok")
`,
      false
    )
    assert.doesNotMatch(out, /getRequestEvent/)
    assert.doesNotMatch(out, /requested/)
    assert.doesNotMatch(out, /import \{ form/)
    assert.match(out, /import \{ __\$mutation, __\$defineQuery \} from "kiru\/remote"/)
  })

  it("preserves users binding for same-file composition", () => {
    const out = transformRemote(
      `
import { mutation, query } from "kiru/remote"
const users = {
  get: query(async () => "u"),
}
export default users
export const run = mutation(async () => users.get())
`,
      true
    )
    assert.match(out, /users\.get\(\)/)
    assert.match(out, /"run": run/)
  })

  it("skips default.* when binding is also a named export", () => {
    const out = transformRemote(
      `
import { query } from "kiru/remote"
export const users = {
  get: query(async () => "u"),
}
export default users
`,
      true
    )
    assert.match(out, /"users\.get": users\.get/)
    assert.doesNotMatch(out, /"default\.get"/)
  })

  it("client stub passes isVoid false for schema mutations", () => {
    const out = transformRemote(
      `
import { mutation } from "kiru/remote"
const idSchema = {
  parse: (input) => String(input),
}
export const api = {
  removeLabel: mutation(idSchema, async (id) => ({ removed: id })),
}
`,
      false
    )
    assert.match(out, /removeLabel: async \(\.\.\.args\) => __\$mutation\(/)
    assert.match(out, /api\.removeLabel`, args, false\)/)
  })
})

describe("prepareRemoteFunctions — server-only kiru/router imports", () => {
  it("client stub strips revalidatePath imports from kiru/router", () => {
    const out = transformRemote(
      `
import { form } from "kiru/remote"
import { revalidatePath, revalidateTag } from "kiru/router"
import { bumpRevalidateGeneration } from "./revalidate-demo.state.js"

export const bump = form(async () => {
  bumpRevalidateGeneration()
  await revalidatePath("/revalidate-demo")
  await revalidateTag("revalidate-demo")
  return { ok: true }
})
`,
      false
    )
    assert.match(out, /export const bump = \{ __kiruFormMutation: true/)
    assert.doesNotMatch(out, /revalidatePath/)
    assert.doesNotMatch(out, /revalidateTag/)
    assert.doesNotMatch(out, /kiru\/router/)
    assert.doesNotMatch(out, /import \{ form \} from "kiru\/remote"/)
  })
})
