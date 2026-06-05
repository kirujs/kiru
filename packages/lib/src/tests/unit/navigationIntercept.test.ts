import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
} from "../../router/index.js"
import { getRouterInstanceRuntime } from "../../router/routerRuntime.js"

function mockHistory() {
  const history = {
    pushState() {},
    replaceState() {},
    back() {},
    forward() {},
    go() {},
    state: { index: 0 },
    length: 1,
  } as unknown as History
  return { history }
}

describe("navigation intercept", () => {
  it("soft navigate returns intercepted and keeps background match", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/photos", async () => ({ default: () => null })),
          createRoute("/photos/[id]", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/photos", search: "", hash: "" } as Location,
    })
    const fromMatch = router.match.peek()!
    getRouterInstanceRuntime(router).registerRouteInterceptor!(
      "/photos/[id]",
      { render: () => null },
      { kind: "route", routeId: fromMatch.route.id }
    )

    const result = await router.navigate("/photos/42")
    assert.equal(result.status, "intercepted")
    assert.equal(router.pathname.peek(), "/photos/42")
    assert.equal(router.match.peek()?.route.path, "/photos")
    assert.ok(router.interceptState.peek())
    assert.equal(router.interceptState.peek()!.targetMatch.params.id, "42")
    router.dispose()
  })

  it("navigate with intercept:false commits full route", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/photos", async () => ({ default: () => null })),
          createRoute("/photos/[id]", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/photos", search: "", hash: "" } as Location,
    })
    const fromMatch = router.match.peek()!
    getRouterInstanceRuntime(router).registerRouteInterceptor!(
      "/photos/[id]",
      { render: () => null },
      { kind: "route", routeId: fromMatch.route.id }
    )

    const result = await router.navigate("/photos/99", { intercept: false })
    assert.equal(result.status, "committed")
    assert.equal(router.match.peek()?.route.path, "/photos/[id]")
    assert.equal(router.interceptState.peek(), null)
    router.dispose()
  })

  it("load throw sets error and null data while intercept stays active", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/photos", async () => ({ default: () => null })),
          createRoute("/photos/[id]", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/photos", search: "", hash: "" } as Location,
    })
    const fromMatch = router.match.peek()!
    getRouterInstanceRuntime(router).registerRouteInterceptor!(
      "/photos/[id]",
      {
        load: async () => {
          throw new Error("intercept load failed")
        },
        render: () => null,
      },
      { kind: "route", routeId: fromMatch.route.id }
    )

    const result = await router.navigate("/photos/5")
    assert.equal(result.status, "intercepted")
    const state = router.interceptState.peek()
    assert.ok(state)
    assert.equal(state!.error?.message, "intercept load failed")
    assert.equal(state!.data, null)
    assert.equal(router.match.peek()?.route.path, "/photos")
    router.dispose()
  })

  it("scope-owned interceptor matches navigation from any child route", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        layout: async () => ({ default: () => null }),
        children: [
          createRoute("/", async () => ({ default: () => null })),
          createRoute("/photos", async () => ({ default: () => null })),
          createRoute("/photos/[id]", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/", search: "", hash: "" } as Location,
    })
    const fromMatch = router.match.peek()!
    const scopeId = fromMatch.route.scopes[0]!.id
    getRouterInstanceRuntime(router).registerRouteInterceptor!(
      "/photos/[id]",
      { render: () => null },
      { kind: "scope", scopeId }
    )

    const result = await router.navigate("/photos/42")
    assert.equal(result.status, "intercepted")
    assert.equal(router.pathname.peek(), "/photos/42")
    assert.equal(router.match.peek()?.route.path, "/")
    router.dispose()
  })

  it("middleware redirect re-enters intercept matching with scope owner", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        layout: async () => ({ default: () => null }),
        children: [
          createRoute("/settings", async () => ({ default: () => null })),
          createRoute("/login", async () => ({ default: () => null })),
          createRoute("/guarded", {
            component: async () => ({ default: () => null }),
            middleware: [() => ({ redirect: "/login" })],
          }),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/settings", search: "", hash: "" } as Location,
    })
    const fromMatch = router.match.peek()!
    const scopeId = fromMatch.route.scopes[0]!.id
    getRouterInstanceRuntime(router).registerRouteInterceptor!(
      "/login",
      { render: () => null },
      { kind: "scope", scopeId }
    )

    const result = await router.navigate("/guarded")
    assert.equal(result.status, "intercepted")
    assert.equal(router.pathname.peek(), "/login")
    assert.equal(router.match.peek()?.route.path, "/settings")
    router.dispose()
  })
})
