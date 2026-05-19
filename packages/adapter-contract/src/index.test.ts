import { describe, it } from "node:test"
import assert from "node:assert"
import {
  composeRespond,
  toFetchHandler,
  type KiruHandle,
} from "./index.js"

describe("@kirujs/adapter-contract", () => {
  it("toFetchHandler maps null to 404", async () => {
    const handle: KiruHandle = async () => null
    const fetch = toFetchHandler(handle)
    const res = await fetch(new Request("http://localhost/"))
    assert.equal(res.status, 404)
  })

  it("toFetchHandler returns Response from handle", async () => {
    const handle: KiruHandle = async () =>
      new Response("ok", {
        status: 201,
        headers: { "x-test": "1" },
      })
    const res = await toFetchHandler(handle)(new Request("http://localhost/"))
    assert.equal(res.status, 201)
    assert.equal(await res.text(), "ok")
    assert.equal(res.headers.get("x-test"), "1")
  })

  it("composeRespond short-circuits on Response", async () => {
    const terminal: KiruHandle = async () =>
      new Response("ssr", { status: 200 })
    const handle = composeRespond(terminal, async () =>
      new Response("static", { status: 200 })
    )
    const out = await handle(new Request("http://localhost/"))
    assert.equal(await out?.text(), "static")
  })
})
