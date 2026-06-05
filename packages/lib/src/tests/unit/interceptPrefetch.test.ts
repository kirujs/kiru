import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
} from "../../router/index.js"
import { prefetchRoute } from "../../router/prefetchRoute.js"
import { matchRoute } from "../../router/manifest.js"
import {
  buildInterceptorPrefetchKey,
  consumePrefetchedInterceptorData,
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

describe("interceptor prefetch", () => {
  it("prefetchRoute runs interceptor load and commit consumes cache", async () => {
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
        load: async ({ params }) => ({ cached: params.id }),
        render: () => null,
      },
      { kind: "route", routeId: fromMatch.route.id }
    )
    const registration = getRouterInstanceRuntime(router)
      .getRouteInterceptorRegistrations!().find(
      (r) =>
        r.owner.kind === "route" && r.owner.routeId === fromMatch.route.id
    )!

    const toMatch = matchRoute(manifest, "/photos/7", { baseUrl: "" })!
    const key = buildInterceptorPrefetchKey(registration.id, toMatch)

    await prefetchRoute({
      manifest,
      href: "/photos/7",
      baseUrl: router.baseUrl,
      router,
      chunks: false,
      data: false,
      interceptLoad: true,
    })

    const cached = consumePrefetchedInterceptorData(key)
    assert.equal(cached.kind, "hit")
    assert.deepEqual(cached.data, { cached: "7" })

    const result = await router.navigate("/photos/7")
    assert.equal(result.status, "intercepted")
    const state = router.interceptState.peek()
    assert.deepEqual(state?.data, { cached: "7" })
    assert.equal(state?.error, null)
    router.dispose()
  })
})
