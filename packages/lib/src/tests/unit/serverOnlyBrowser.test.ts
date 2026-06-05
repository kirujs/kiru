import assert from "node:assert"
import { describe, it } from "node:test"
import { query, mutation, form, requested } from "../../remote/browser.js"
import {
  createRemoteHandler,
  makeKiruContextToken,
} from "../../remote/serverOnlyBrowser.js"
import { getRequestEvent } from "../../remote/remoteRequestEvent.client.js"

describe("kiru/remote browser entry — server-only stubs", () => {
  it("requested() warns and throws", () => {
    assert.throws(
      () => requested({} as never, 1),
      /resolves client-posted query wire entries/
    )
  })

  it("query() warns and throws", () => {
    assert.throws(
      () => query(async () => "x"),
      /Define remotes in `.remote.ts`/
    )
  })

  it("mutation() warns and throws", () => {
    assert.throws(
      () => mutation(async () => "x"),
      /Define remotes in `.remote.ts`/
    )
  })

  it("form() warns and throws", () => {
    assert.throws(
      () => form(async () => ({ ok: true })),
      /Define remotes in `.remote.ts`/
    )
  })

  it("makeKiruContextToken() warns and throws", () => {
    assert.throws(
      () => makeKiruContextToken({}, "secret"),
      /Context tokens are signed and verified on the server only/
    )
  })

  it("createRemoteHandler() warns and throws", () => {
    assert.throws(
      () => createRemoteHandler("secret"),
      /createRemoteHandler\(\) registers the server RPC entry point/
    )
  })

  it("getRequestEvent() warns and throws", () => {
    assert.throws(
      () => getRequestEvent(),
      /getRequestEvent\(\) can only be called inside a remote handler/
    )
  })
})
