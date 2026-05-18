import { describe, it } from "node:test"
import assert from "node:assert"
import {
  composeRespond,
  toFetchHandler,
  toWebResponse,
  type KiruHandle,
} from "./index.js"

describe("@kirujs/adapter-contract", () => {
  it("toFetchHandler maps null to 404", async () => {
    const handle: KiruHandle = async () => null
    const fetch = toFetchHandler(handle)
    const res = await fetch(new Request("http://localhost/"))
    assert.equal(res.status, 404)
  })

  it("toFetchHandler returns Kiru body", async () => {
    const handle: KiruHandle = async () => ({
      status: 201,
      headers: { "x-test": "1" },
      body: "ok",
    })
    const res = await toFetchHandler(handle)(new Request("http://localhost/"))
    assert.equal(res.status, 201)
    assert.equal(await res.text(), "ok")
    assert.equal(res.headers.get("x-test"), "1")
  })

  it("composeRespond short-circuits on KiruResponse", async () => {
    const terminal: KiruHandle = async () => ({
      status: 200,
      headers: {},
      body: "ssr",
    })
    const handle = composeRespond(terminal, async () => {
      return { status: 200, headers: {}, body: "static" }
    })
    const kiru = await handle(new Request("http://localhost/"))
    assert.equal(kiru?.body, "static")
  })

  it("toWebResponse round-trips", async () => {
    const res = toWebResponse({ status: 200, headers: {}, body: "hi" })
    assert.equal(await res.text(), "hi")
  })
})
