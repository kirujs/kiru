import { describe, it } from "node:test"
import assert from "node:assert"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "./shared.js"
import { prepareRemoteFunctions } from "./remote.js"

const PROJECT_ROOT = "/project"
const ACTIONS_FILE = `${PROJECT_ROOT}/src/pages/demo.actions.ts`

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
import { action } from "kiru/remote"
export default {
  get: action(async () => "ok"),
}
`,
      false
    )
    assert.match(out, /export default \{ get: async \(options\)/)
    assert.match(out, /default\.get/)
    assert.doesNotMatch(out, /__kiru_default/)
    assert.doesNotMatch(out, /async \(\) => "ok"/)
  })

  it("SSR rewrites anonymous default namespace and registers default.*", () => {
    const out = transformRemote(
      `
import { action } from "kiru/remote"
export default {
  get: action(async () => "ok"),
}
`,
      true
    )
    assert.match(out, /const __kiru_default = \{/)
    assert.match(out, /export default __kiru_default/)
    assert.match(out, /"default\.get": __kiru_default\.get/)
    assert.match(out, /__kiru_default\.get\.__kiruActionId/)
  })

  it("client and SSR handle flat default export", () => {
    const client = transformRemote(
      `
import { action } from "kiru/remote"
export default action(async () => "flat")
`,
      false
    )
    assert.match(client, /export default async \(options\)/)
    assert.match(client, /default/)

    const server = transformRemote(
      `
import { action } from "kiru/remote"
export default action(async () => "flat")
`,
      true
    )
    assert.match(server, /const __kiru_default = action\(/)
    assert.match(server, /"default": __kiru_default/)
  })

  it("coexists with named exports", () => {
    const out = transformRemote(
      `
import { action } from "kiru/remote"
export const foo = action(async () => "foo")
export default { get: action(async () => "d") }
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
import { action } from "kiru/remote"
const users = {
  get: action(async () => "u"),
}
export default users
`,
      true
    )
    assert.match(out, /"default\.get": users\.get/)
    assert.match(out, /users\.get\.__kiruActionId.*default\.get/)
    assert.doesNotMatch(out, /__kiru_default/)
    assert.match(out, /export default users/)
  })

  it("client stubs linked const and keeps export default users", () => {
    const out = transformRemote(
      `
import { action } from "kiru/remote"
const users = {
  get: action(async () => "u"),
}
export default users
`,
      false
    )
    assert.match(out, /const users = \{ get: async \(options\)/)
    assert.match(out, /export default users/)
    assert.match(out, /default\.get/)
    assert.doesNotMatch(out, /async \(\) => "u"/)
  })

  it("preserves users binding for same-file composition", () => {
    const out = transformRemote(
      `
import { action } from "kiru/remote"
const users = {
  get: action(async () => "u"),
}
export default users
export const run = action(async () => users.get())
`,
      true
    )
    assert.match(out, /users\.get\(\)/)
    assert.match(out, /"run": run/)
  })

  it("skips default.* when binding is also a named export", () => {
    const out = transformRemote(
      `
import { action } from "kiru/remote"
export const users = {
  get: action(async () => "u"),
}
export default users
`,
      true
    )
    assert.match(out, /"users\.get": users\.get/)
    assert.doesNotMatch(out, /"default\.get"/)
  })
})
