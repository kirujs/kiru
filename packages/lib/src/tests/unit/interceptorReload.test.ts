import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
} from "../../router/index.js"
import {
  buildInterceptorRuntimeDeps,
  reloadInterceptorLoad,
} from "../../router/routeInterceptors.js"
import { getRouterInstanceRuntime } from "../../router/routerRuntime.js"

function mockHistory() {
  return {
    history: {
      pushState() {},
      replaceState() {},
      back() {},
      forward() {},
      go() {},
      state: { index: 0 },
      length: 1,
    } as unknown as History,
  }
}

describe("interceptor reload", () => {
  it("reloadInterceptorLoad re-runs load after failure and updates data", async () => {
    let attempts = 0
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
    const runtime = getRouterInstanceRuntime(router)
    runtime.registerRouteInterceptor!(
      "/photos/[id]",
      {
        load: async () => {
          attempts += 1
          if (attempts === 1) throw new Error("load failed")
          return { ok: true }
        },
        render: () => null,
      },
      fromMatch.route.id
    )
    const registration = runtime.getRouteInterceptorRegistrations!()[0]!

    await router.navigate("/photos/1")
    assert.equal(router.interceptState.peek()?.error?.message, "load failed")
    assert.equal(router.interceptState.peek()?.data, null)

    const deps = buildInterceptorRuntimeDeps(router, runtime)
    await reloadInterceptorLoad(deps, registration.id)

    assert.equal(attempts, 2)
    assert.equal(router.interceptState.peek()?.error, null)
    assert.deepEqual(router.interceptState.peek()?.data, { ok: true })
    router.dispose()
  })
})
