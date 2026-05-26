import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
} from "../../router/index.js"
import { RouteMiddlewareHttpError } from "../../router/types.js"

function mockHistory() {
  const historyEvents: Array<{ kind: "push" | "replace"; to: string }> = []
  const history = {
    pushState(_a: unknown, _b: unknown, to: string) {
      historyEvents.push({ kind: "push", to })
    },
    replaceState(_a: unknown, _b: unknown, to: string) {
      historyEvents.push({ kind: "replace", to })
    },
    state: {},
  } as History
  return { history, historyEvents }
}

describe("CSR navigation middleware errors", () => {
  it("returns errored and does not redirect to /login on { error: 403 }", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        middleware: [
          (ctx) => {
            if (ctx.to.pathname === "/forbidden") return { error: 403 }
            return
          },
        ],
        children: [
          createRoute("/", async () => ({ default: () => null })),
          createRoute("/forbidden", async () => ({ default: () => null })),
          createRoute("/login", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/" } as Location,
    })
    const result = await router.navigate("/forbidden")
    assert.strictEqual(result.status, "errored")
    assert.strictEqual(router.path(), "/forbidden")
    assert.notStrictEqual(router.path(), "/login")
    const err = router.outletRenderError.peek()
    assert.ok(err instanceof RouteMiddlewareHttpError)
    assert.strictEqual(err.status, 403)
  })

  it("surfaces middleware error body on { error: 503, body }", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        middleware: [() => ({ error: 503, body: "maintenance" })],
        children: [
          createRoute("/", async () => ({ default: () => null })),
          createRoute("/down", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/" } as Location,
    })
    await router.navigate("/down")
    const err = router.outletRenderError.peek()
    assert.ok(err instanceof RouteMiddlewareHttpError)
    assert.strictEqual(err.status, 503)
    assert.strictEqual(err.message, "maintenance")
  })

  it("returns errored on { error: 401 }", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        middleware: [
          (ctx) => {
            if (ctx.to.pathname === "/private") return { error: 401 }
            return
          },
        ],
        children: [
          createRoute("/", async () => ({ default: () => null })),
          createRoute("/private", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/" } as Location,
    })
    const result = await router.navigate("/private")
    assert.strictEqual(result.status, "errored")
    assert.strictEqual(
      (router.outletRenderError.peek() as RouteMiddlewareHttpError).status,
      401
    )
  })

  it("still redirects when middleware returns { redirect: '/login' }", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        middleware: [
          (ctx) => {
            if (ctx.to.pathname === "/about") return { redirect: "/login" }
            return
          },
        ],
        children: [
          createRoute("/", async () => ({ default: () => null })),
          createRoute("/about", async () => ({ default: () => null })),
          createRoute("/login", async () => ({ default: () => null })),
        ],
      })
    )
    const { history, historyEvents } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/" } as Location,
    })
    await router.navigate("/about")
    assert.strictEqual(router.path(), "/login")
    assert.ok(historyEvents.some((e) => e.to.includes("/login")))
  })

  it("still aborts navigation without changing path", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        middleware: [() => ({ abort: true })],
        children: [
          createRoute("/", async () => ({ default: () => null })),
          createRoute("/about", async () => ({ default: () => null })),
        ],
      })
    )
    const { history, historyEvents } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/" } as Location,
    })
    const result = await router.navigate("/about")
    assert.strictEqual(result.status, "cancelled")
    assert.strictEqual(router.path(), "/")
    assert.strictEqual(historyEvents.length, 0)
  })
})
