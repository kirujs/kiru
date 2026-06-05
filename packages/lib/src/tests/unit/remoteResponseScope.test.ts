import { describe, it } from "node:test"
import assert from "node:assert"
import {
  commitRemoteResponseScope,
  createRemoteResponseScope,
} from "../../remote/remoteResponseScope.js"
import { RemoteCookies } from "../../remote/remoteCookies.js"
import { createRemoteExecutionForRequest } from "../../remote/index.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"

describe("RemoteResponseScope", () => {
  it("commits context only when mutated", () => {
    const execution = createRemoteExecutionForRequest({
      context: { count: 1 } as Record<string, unknown>,
      signal: staticLoaderSignal(),
      request: new Request("http://localhost/"),
      headers: new Headers(),
      entryActionId: "t:a",
    })
    const scope = createRemoteResponseScope(execution)
    assert.strictEqual(commitRemoteResponseScope(scope, null).context, undefined)
    ;(scope.context as Record<string, unknown>).count = 2
    assert.deepStrictEqual(
      commitRemoteResponseScope(scope, null).context,
      { count: 2 }
    )
  })

  it("commits response headers and cookies", () => {
    const execution = createRemoteExecutionForRequest({
      context: {},
      signal: staticLoaderSignal(),
      request: new Request("http://localhost/"),
      headers: new Headers(),
      entryActionId: "t:a",
    })
    const scope = createRemoteResponseScope(execution)
    scope.headers.set("x-test", "1")
    scope.cookies.set("sid", "abc")
    const meta = commitRemoteResponseScope(scope, "ok")
    assert.strictEqual(meta.responseHeaders.get("x-test"), "1")
    assert.ok(meta.cookies.some((c) => c.name === "sid" && c.value === "abc"))
  })

  it("RemoteCookies.defaults apply to set()", () => {
    const prev = { ...RemoteCookies.defaults }
    RemoteCookies.defaults = { path: "/", httpOnly: true, secure: false, sameSite: "Strict" }
    try {
      const cookies = new RemoteCookies()
      cookies.set("a", "b")
      const spec = cookies.toSetCookieList()[0]!
      assert.strictEqual(spec.sameSite, "Strict")
      assert.strictEqual(spec.secure, false)
    } finally {
      RemoteCookies.defaults = prev
    }
  })
})
