import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
} from "../../router/index.js"
import { getRouterRuntime } from "../../router/routerRuntime.js"

describe("onAfterRouteEnter (enter guards)", () => {
  it("runs after a successful navigation commits", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/a", async () => ({ default: () => null })),
          createRoute("/b", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/a" } as Location,
    })
    let entered = false
    getRouterRuntime(router).registerComponentGuard(
      "enter",
      () => {
        entered = true
      }
    )
    await router.navigate("/b")
    assert.equal(entered, true)
    assert.equal(router.pathname.value, "/b")
  })

  it("ignores false return and keeps committed location", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/a", async () => ({ default: () => null })),
          createRoute("/b", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/a" } as Location,
    })
    getRouterRuntime(router).registerComponentGuard("enter", () => false)
    const result = await router.navigate("/b")
    assert.equal(result.status, "committed")
    assert.equal(router.pathname.value, "/b")
  })

  it("ignores redirect return after commit", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/a", async () => ({ default: () => null })),
          createRoute("/b", async () => ({ default: () => null })),
          createRoute("/c", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/a" } as Location,
    })
    getRouterRuntime(router).registerComponentGuard("enter", () => "/c")
    await router.navigate("/b")
    assert.equal(router.pathname.value, "/b")
  })
})

function mockHistory() {
  const history = {
    pushState() {},
    replaceState() {},
    state: {},
  } as any as History
  return { history }
}
