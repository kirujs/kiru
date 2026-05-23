import { describe, it } from "node:test"
import assert from "node:assert"
import {
  commitActionResponseScope,
  createActionResponseScope,
} from "../../remote/actionResponseScope.js"
import { ActionCookies } from "../../remote/actionCookies.js"
import { createActionExecutionForRequest } from "../../remote/index.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"

describe("ActionResponseScope", () => {
  it("commits context only when mutated", () => {
    const execution = createActionExecutionForRequest({
      context: { count: 1 } as Record<string, unknown>,
      signal: staticLoaderSignal(),
      request: new Request("http://localhost/"),
      headers: new Headers(),
      entryActionId: "t:a",
    })
    const scope = createActionResponseScope(execution)
    assert.strictEqual(commitActionResponseScope(scope, null).context, undefined)
    ;(scope.context as Record<string, unknown>).count = 2
    assert.deepStrictEqual(
      commitActionResponseScope(scope, null).context,
      { count: 2 }
    )
  })

  it("commits response headers and cookies", () => {
    const execution = createActionExecutionForRequest({
      context: {},
      signal: staticLoaderSignal(),
      request: new Request("http://localhost/"),
      headers: new Headers(),
      entryActionId: "t:a",
    })
    const scope = createActionResponseScope(execution)
    scope.headers.set("x-test", "1")
    scope.cookies.set("sid", "abc")
    const meta = commitActionResponseScope(scope, "ok")
    assert.strictEqual(meta.responseHeaders.get("x-test"), "1")
    assert.ok(meta.cookies.some((c) => c.name === "sid" && c.value === "abc"))
  })

  it("ActionCookies.defaults apply to set()", () => {
    const prev = { ...ActionCookies.defaults }
    ActionCookies.defaults = { path: "/", httpOnly: true, secure: false, sameSite: "Strict" }
    try {
      const cookies = new ActionCookies()
      cookies.set("a", "b")
      const spec = cookies.toSetCookieList()[0]!
      assert.strictEqual(spec.sameSite, "Strict")
      assert.strictEqual(spec.secure, false)
    } finally {
      ActionCookies.defaults = prev
    }
  })
})
