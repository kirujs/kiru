import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
} from "../../router/index.js"
import { getRouterInstanceRuntime } from "../../router/routerRuntime.js"
import type { InterceptorRegistration } from "../../router/routeInterceptors.js"
import { withJSDOM } from "./jsdom.js"

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

  it("hard navigate from active intercept commits full route", async () => {
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

    const soft = await router.navigate("/photos/42")
    assert.equal(soft.status, "intercepted")
    assert.equal(router.pathname.peek(), "/photos/42")
    assert.equal(router.match.peek()?.route.path, "/photos")
    assert.ok(router.interceptState.peek())

    const hard = await router.navigate("/photos/42", { intercept: false })
    assert.equal(hard.status, "committed")
    assert.equal(router.pathname.peek(), "/photos/42")
    assert.equal(router.match.peek()?.route.path, "/photos/[id]")
    assert.equal(router.interceptState.peek(), null)
    router.dispose()
  })

  it("popstate back from intercept URL restores background", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/photos", async () => ({ default: () => null })),
          createRoute("/photos/[id]", async () => ({ default: () => null })),
        ],
      })
    )

    await withJSDOM(
      async () => {
        const router = createRouter({
          routes: manifest,
          location: {
            pathname: "/photos",
            search: "",
            hash: "",
          } as Location,
        })
        const fromMatch = router.match.peek()!
        getRouterInstanceRuntime(router).registerRouteInterceptor!(
          "/photos/[id]",
          { render: () => null },
          { kind: "route", routeId: fromMatch.route.id }
        )

        await router.navigate("/photos/7")
        assert.equal(router.interceptState.peek()?.targetMatch.params.id, "7")
        assert.equal(window.location.pathname, "/photos/7")

        window.history.back()
        await new Promise((r) => setTimeout(r, 50))

        assert.equal(router.pathname.peek(), "/photos")
        assert.equal(router.match.peek()?.route.path, "/photos")
        assert.equal(router.interceptState.peek(), null)
        router.dispose()
      },
      { url: "http://localhost/photos" }
    )
  })

  it("popstate forward restores intercept after back", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/photos", async () => ({ default: () => null })),
          createRoute("/photos/[id]", async () => ({ default: () => null })),
        ],
      })
    )

    await withJSDOM(
      async () => {
        const router = createRouter({
          routes: manifest,
          location: {
            pathname: "/photos",
            search: "",
            hash: "",
          } as Location,
        })
        const fromMatch = router.match.peek()!
        getRouterInstanceRuntime(router).registerRouteInterceptor!(
          "/photos/[id]",
          { render: () => null },
          { kind: "route", routeId: fromMatch.route.id }
        )

        await router.navigate("/photos/7")
        assert.equal(router.interceptState.peek()?.targetMatch.params.id, "7")
        assert.equal(window.location.pathname, "/photos/7")

        window.history.back()
        await new Promise((r) => setTimeout(r, 50))

        assert.equal(router.pathname.peek(), "/photos")
        assert.equal(router.interceptState.peek(), null)

        window.history.forward()
        await new Promise((r) => setTimeout(r, 50))

        assert.equal(router.pathname.peek(), "/photos/7")
        assert.equal(router.match.peek()?.route.path, "/photos")
        assert.ok(router.interceptState.peek())
        assert.equal(router.interceptState.peek()!.targetMatch.params.id, "7")
        router.dispose()
      },
      { url: "http://localhost/photos" }
    )
  })

  it("popstate forward restores intercept when registration id drifted", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/photos", async () => ({ default: () => null })),
          createRoute("/photos/[id]", async () => ({ default: () => null })),
        ],
      })
    )

    await withJSDOM(
      async () => {
        const router = createRouter({
          routes: manifest,
          location: {
            pathname: "/photos",
            search: "",
            hash: "",
          } as Location,
        })
        const fromMatch = router.match.peek()!
        const runtime = getRouterInstanceRuntime(router)
        runtime.registerRouteInterceptor!(
          "/photos/[id]",
          { render: () => null },
          { kind: "route", routeId: fromMatch.route.id }
        )

        await router.navigate("/photos/9")
        const historyRegId = (
          window.history.state as { kiruIntercept?: { registrationId: number } }
        ).kiruIntercept?.registrationId
        assert.ok(historyRegId != null)

        window.history.back()
        await new Promise((r) => setTimeout(r, 50))

        const registrations =
          runtime.getRouteInterceptorRegistrations!() as InterceptorRegistration[]
        assert.equal(registrations.length, 1)
        registrations.splice(0, 1)
        runtime.registerRouteInterceptor!(
          "/photos/[id]",
          { render: () => null },
          { kind: "route", routeId: fromMatch.route.id }
        )
        const newRegId = runtime.getRouteInterceptorRegistrations!()[0]!.id
        assert.notEqual(newRegId, historyRegId)

        window.history.forward()
        await new Promise((r) => setTimeout(r, 50))

        assert.equal(router.pathname.peek(), "/photos/9")
        assert.equal(router.match.peek()?.route.path, "/photos")
        assert.ok(router.interceptState.peek())
        assert.equal(router.interceptState.peek()!.registrationId, newRegId)
        assert.equal(router.interceptState.peek()!.targetMatch.params.id, "9")
        router.dispose()
      },
      { url: "http://localhost/photos" }
    )
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

  it("scope-owned interceptor activates handle on intercept", async () => {
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
    const handle = getRouterInstanceRuntime(router).registerRouteInterceptor!(
      "/photos/[id]",
      { render: () => null },
      { kind: "scope", scopeId }
    )
    assert.equal(handle.isActive.value, false)

    const result = await router.navigate("/photos/42")
    assert.equal(result.status, "intercepted")
    assert.equal(handle.isActive.value, true)
    router.dispose()
  })

  it("intercepts after full-page visit then return home", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        layout: async () => ({ default: () => null }),
        children: [
          createRoute("/", async () => ({ default: () => null })),
          createRoute("/photos/[id]", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/photos/1", search: "", hash: "" } as Location,
    })
    const scopeId = router.match.peek()!.route.scopes[0]!.id
    getRouterInstanceRuntime(router).registerRouteInterceptor!(
      "/photos/[id]",
      { render: () => null },
      { kind: "scope", scopeId }
    )

    const fullPage = await router.navigate("/photos/1", { intercept: false })
    assert.equal(fullPage.status, "committed")
    assert.equal(router.match.peek()?.route.path, "/photos/[id]")

    const home = await router.navigate("/")
    assert.equal(home.status, "committed")
    assert.equal(router.match.peek()?.route.path, "/")

    const intercepted = await router.navigate("/photos/2")
    assert.equal(intercepted.status, "intercepted")
    assert.equal(router.pathname.peek(), "/photos/2")
    assert.equal(router.match.peek()?.route.path, "/")
    assert.ok(router.interceptState.peek())
    assert.equal(router.interceptState.peek()!.targetMatch.params.id, "2")
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

  it("intercept load ignores stale aborted remote abort scope", async () => {
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
        load: async ({ signal }) => {
          if (signal.aborted) {
            throw new Error("signal is aborted without reason")
          }
          return { title: "Loaded" }
        },
        render: () => null,
      },
      { kind: "route", routeId: fromMatch.route.id }
    )

    const stale = new AbortController()
    stale.abort()
    const { runWithRemoteAbortSignal } = await import(
      "../../remote/abortScope.js"
    )
    await runWithRemoteAbortSignal(stale.signal, async () => {
      const result = await router.navigate("/photos/7")
      assert.equal(result.status, "intercepted")
      assert.deepEqual(router.interceptState.peek()?.data, { title: "Loaded" })
    })
    router.dispose()
  })
})
