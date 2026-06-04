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
      fromMatch.route.id
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
      fromMatch.route.id
    )

    const result = await router.navigate("/photos/99", { intercept: false })
    assert.equal(result.status, "committed")
    assert.equal(router.match.peek()?.route.path, "/photos/[id]")
    assert.equal(router.interceptState.peek(), null)
    router.dispose()
  })
})
